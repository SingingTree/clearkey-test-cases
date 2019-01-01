"use strict";

/**
 * Write a message to the log <div> on page
 * @param msg - The message to log
 */
function log(msg) {
  let logDiv = document.getElementById("logDiv");
  logDiv.appendChild(document.createTextNode(msg));
  logDiv.appendChild(document.createElement("br"));
}

/**
 * Create a source buffer and attempt to fetch media data from a url into it.
 * @param mediaSource - The mediaSource object to add the buffer to.
 * @param mediaUrl - The URL to fetch the media from.
 * @param mediaMimeType - The mime type of the media being fetched.
 * @param progressCallback - The callback to be used by xhr during fetching.
 * @return A promise that will be resolved once the source buffer had received
 * the 'updateend' event.
 */
function loadSourceBuffer(mediaSource, mediaURL, mediaMimeType, progressCallback) {
  log("Loading: " + mediaURL);
  log("Media source state: " + mediaSource.readyState); // open
  let sourceBuffer = mediaSource.addSourceBuffer(mediaMimeType);
  // Promise to resolve when our source buffer has updateend
  let fetchedPromise = new Promise(resolve => {
    sourceBuffer.addEventListener("updateend", () => {
      resolve();
    });
  });
  fetchArrayBuffer(
    mediaURL,
    buf => {
      sourceBuffer.appendBuffer(buf);
    },
    progressCallback
  );
  return fetchedPromise;
}

/**
 * Updates the video text and progress bar on page with information from the
 * progress event. Intended to be passed into the {loadSourceBuffer} function as
 * a progress callback
 * @param e - The progress event from an xhr
 */
function updateVideoProgress(e) {
  let videoProgress = document.getElementById("videoProgress");
  if (e.lengthComputable) {
    videoProgress.value = (e.loaded / e.total) * 100;
  }
}

/**
 * Updates the audio text and progress bar on page with information from the
 * progress event. Intended to be passed into the {loadSourceBuffer} function as
 * a progress callback
 * @param e - The progress event from an xhr
 */
function updateAudioProgress(e) {
  let audioProgress = document.getElementById("audioProgress");
  if (e.lengthComputable) {
    audioProgress.value = (e.loaded / e.total) * 100;
  }
}

/**
 * Helper function to fetch a resource at a url into an array buffer with xhr
 * @param url - The URL to fetch from
 * @param onLoadFunc - A callback for when with xhr.response once the xhr has
 * loaded
 * @param onProgressFunc - A callback for when the xhr emits 'progress' events
 */
function fetchArrayBuffer(url, onLoadFunc, onProgressFunc) {
  log("Fetching from URL: " + url);
  let xhr = new XMLHttpRequest();
  xhr.onprogress = onProgressFunc;
  xhr.open("get", url);
  xhr.responseType = "arraybuffer";
  xhr.onload = () => {
    onLoadFunc(xhr.response);
  };
  xhr.send();
}

/**
 * Key id for the encryption key
 */
const keyId = "ASNFZ4mrze8BI0VniavN7w";

/**
 * Encryption key
 */
const key = new Uint8Array([
  0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10,
  0xFE, 0xDC, 0xBA, 0x98, 0x76, 0x54, 0x32, 0x10
]);


/**
 * Map from key ids to actual keys. This is used when generating licenses
 */
let keyMap = new Map();
keyMap.set(keyId, key);

/**
 * Helper to convert Uint8Array into base64 using base64url alphabet, without padding.
 * @param u8arr - An array of bytes to convert to base64.
 * @return A base 64 encoded string
 */
function toBase64(u8arr) {
  return btoa(String.fromCharCode.apply(null, u8arr)).
      replace(/\+/g, "-").replace(/\//g, "_").replace(/=*$/, "");
}
/**
 * Attempts to setup key system access, create media keys, and set those keys on
 * a media element.
 * @param media - The media element to setup media keys on.
 * @param config - The MediaKeySystemConfiguration to be used when requesting key
 * system access.
 * @return A promise that will be resolved upon successfully setting the media
 * keys on the passed media, or rejected with reason if the process fails.
 */
async function setupMediaKeys(media, config) {
  let keySystemAccess = await navigator.requestMediaKeySystemAccess("org.w3.clearkey", config);
  let mediaKeys = await keySystemAccess.createMediaKeys();
  return media.setMediaKeys(mediaKeys);
}

/**
 * Function that handles the encrypted event fired by a media element. Deligates
 * to other functions to handle license requests.
 * @param e - The encrypted event.
 * @return The promise created by MediaKeySession.generateRequest
 */
function encryptedEventHandler(e) {
  log("Got encrypted event");

  let media = e.target;
  let session = media.mediaKeys.createSession();
  session.addEventListener("message", messageHandler);
  return session.generateRequest(e.initDataType, e.initData);
}

/**
 * Generates a clearkey license for a given license request.
 * @param message - A message from the CDM desribing a licence request.
 * @return A JSON string of the clearkey license object for the given message.
 */
function generateLicense(message) {
  // Parse the clearkey license request.
  let request = JSON.parse(new TextDecoder().decode(message));
  // We expect to only have one key requested at a time
  if (request.kids.length != 1) {
    log(`Got more than one key requested (got ${request.kids.length})! We don't expect this!`);
  }

  // Create our clear key object, looking up the key based on the key id
  let keyObj = {
    kty: "oct",
    kid: request.kids[0],
    k: toBase64(keyMap.get(request.kids[0]))
  };
  return new TextEncoder().encode(JSON.stringify({
    keys: [keyObj]
  }));
}

/**
 * Generates a clearkey license for a given license request.
 * @param e - The 'message' event
 */
function messageHandler(e) {
  let session = e.target;
  let license = generateLicense(e.message);
  session.update(license).catch(
    function(failureReason) {
     log("update() failed: " + failureReason.message);
    }
  );
}

/**
 * Updates the video element to play currently selected media.
 */
function refreshMedia() {
  const h264MimeType = "video/mp4;codecs=\"avc1.640028\""; // High level 4
  const aacMimeType = "audio/mp4;codecs=\"mp4a.40.2\""; // AAC-LC
  const vp9MimeType = "video/webm;codecs=\"vp9\"";
  const opusMimeType = "audio/webm;codecs=\"opus\"";

  // Reset the media element
  let mediaElement = document.getElementById("mediaElement");
  mediaElement.pause();
  mediaElement.removeAttribute("src");
  mediaElement.load();

  // Clear the log
  let logDiv = document.getElementById("logDiv");
  logDiv.innerHTML = "";

  // Build up a path to our video file, and mime info
  let videoCodecContainerSelect = document.getElementById("videoCodecContainerSelect");
  let videoEncryptionSchemeSelect = document.getElementById("videoEncryptionSchemeSelect");
  let videoPath = null;
  let videoExtension= null;
  let videoMimeType = null;
  switch (videoCodecContainerSelect.selectedIndex) {
    case 0: // None
      break;
    case 1: // h264 + mp4
      videoPath = "media/mp4";
      videoExtension = ".mp4";
      videoMimeType = h264MimeType;
      break;
    case 2: // vp9 + webm
      videoPath = "media/webm";
      videoExtension = ".webm";
      videoMimeType = vp9MimeType;
      break;
    default:
      log(`Video codec + container selection has invalid index: (${videoCodecContainerSelect.selectedIndex})!`);
      break;
  }

  if (videoPath) {
    switch (videoEncryptionSchemeSelect.selectedIndex) {
      case 0: // Unencrypted
        videoPath += "/unencrypted/big-buck-bunny-trailer-video" + videoExtension;
        break;
      case 1: // cenc
        videoPath += "/cenc/big-buck-bunny-trailer-video-cenc" + videoExtension;
        break;
      case 2: // cbcs
        if (videoPath == "media/webm") {
          log("webm does not have a cbcs mode, this won't work");
          videoPath = null;
          videoExtension = null;
          videoMimeType = null;
        } else {
          videoPath += "/cbcs/big-buck-bunny-trailer-video-cbcs" + videoExtension;
        }
        break;
      default:
        log(`Video encryption selection has invalid index: (${videoCodecContainerSelect.selectedIndex})!`);
        break;
    }
  }

  // Build up a path to our audio file, and mime info
  let audioCodecContainerSelect = document.getElementById("audioCodecContainerSelect");
  let audioEncryptionSchemeSelect = document.getElementById("audioEncryptionSchemeSelect");
  let audioPath = null;
  let audioExtension = null;
  let audioMimeType = null;
  switch (audioCodecContainerSelect.selectedIndex) {
    case 0: // None
      break;
    case 1: // aac + mp4
      audioPath = "media/mp4";
      audioExtension = ".mp4";
      audioMimeType = aacMimeType;
      break;
    case 2: // opus + webm
      audioPath = "media/webm";
      audioExtension = ".webm";
      audioMimeType = opusMimeType;
      break;
    default:
      log(`Audio codec + container selection has invalid index: (${audioCodecContainerSelect.selectedIndex})!`);
      break;
  }

  if (audioPath) {
    switch (audioEncryptionSchemeSelect.selectedIndex) {
      case 0: // Unencrypted
      audioPath += "/unencrypted/big-buck-bunny-trailer-audio" + audioExtension;
        break;
      case 1: // cenc
      audioPath += "/cenc/big-buck-bunny-trailer-audio-cenc" + audioExtension;
        break;
      case 2: // cbcs
        if (videoPath == "media/webm") {
          log("webm does not have a cbcs mode, this won't work");
          audioPath = null;
          audioExtension = null;
          audioMimeType = null;
        } else {
          audioPath += "/cbcs/big-buck-bunny-trailer-audio-cbcs" + audioExtension;
        }
        break;
      default:
      log(`Audio encryption selection has invalid index: (${audioCodecContainerSelect.selectedIndex})!`);
      break;
    }
  }

  // Bail early for the no audio or video case.
  if (!videoPath && !audioPath) {
    return;
  }

  let keySystemConfig = {
    // This is not exactly how this should work, as mixing cenc and webm init
    // data is odd. The user agent is allowed ot say it has support if it only
    // support "cenc" OR "webm" here, but kludge this for now.
    initDataTypes: ["cenc", "webm"]
  };
  if (videoPath) {
    keySystemConfig.videoCapabilities = [{contentType: videoMimeType}];
  }
  if (audioPath) {
    keySystemConfig.audioCapabilities = [{contentType: audioMimeType}];
  }
  let config = [
    keySystemConfig
  ];

  let mediaSource = new MediaSource();
  log("Media source state: " + mediaSource.readyState); // Should be closed
  
  mediaElement.addEventListener("error", e => {
    log("Got error!: " + e);
  });

  setupMediaKeys(mediaElement, config).then(
    () => {
      mediaElement.addEventListener("encrypted", encryptedEventHandler);
      mediaElement.src = URL.createObjectURL(mediaSource);
      mediaSource.addEventListener("sourceopen", () => {
        let promises = [];
        if (videoPath) {
          promises.push(
            loadSourceBuffer(mediaSource, videoPath,
              videoMimeType, updateVideoProgress)
          )
        }
        if (audioPath) {
          promises.push(
            loadSourceBuffer(mediaSource, audioPath,
              audioMimeType, updateAudioProgress)
          );
        }
        Promise.all(promises).then(() => {
          mediaSource.endOfStream();
          log("Media source state: " + mediaSource.readyState); // Should be ended
          mediaElement.play();
        });
      });
    },
    failureReason => {
      log("Failed to setup media keys: " + failureReason.message);
    }
  );
}

/**
 * Programatically finishes setting up the page by attaching event handlers.
 */
function setupPage() { // eslint-disable-line no-unused-vars
  document.getElementById("videoCodecContainerSelect").onchange = refreshMedia;
  document.getElementById("videoEncryptionSchemeSelect").onchange = refreshMedia;
  document.getElementById("audioCodecContainerSelect").onchange = refreshMedia;
  document.getElementById("audioEncryptionSchemeSelect").onchange = refreshMedia;
  refreshMedia();
}