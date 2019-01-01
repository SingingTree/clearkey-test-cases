A collection of clearkey test cases for use when testing Encrypted Media Extensions (EME) in browsers.

# Media

Original Big Buck Bunny trailer from https://peach.blender.org/trailer-page/.

[Shaka-packager](https://github.com/google/shaka-packager) is used to pack various files. Because the examples were created on Windows the packager executable is `packager-win`, this will need to change depending on platform.

## Unencrypted file creation

The different unencrypted files were created via the following [ffmpeg](https://www.ffmpeg.org/) commands:
- mp4 video: `ffmpeg -i big-buck-bunny-trailer-1080p.ogg -c:v libx264 -an big-buck-bunny-trailer-video-tmp.mp4`
- mp4 audio: `ffmpeg -i big-buck-bunny-trailer-1080p.ogg -vn big-buck-bunny-trailer-audio-tmp.mp4`
- webm video: `ffmpeg -i big-buck-bunny-trailer-1080p.ogg -c:v libvpx-vp9 -crf 30 -b:v 0 -an big-buck-bunny-trailer-video.webm`
- webm audio: `ffmpeg -i big-buck-bunny-trailer-1080p.ogg -vn big-buck-bunny-trailer-audio.webm`

The mp4 files above need to be repacked to be in a suitable format for Media Source Extensions/Encrypted Media Extensions:, via shaka-packager

`packager-win in=big-buck-bunny-trailer-video-tmp.mp4,stream=video,output=big-buck-bunny-trailer-video.mp4, in=big-buck-bunny-trailer-audio-tmp.mp4,stream=audio,output=big-buck-bunny-trailer-audio.mp4`

## Encrypted file creation

### cenc

Note:
- Here 'cenc' refers to the specific cenc encryption scheme detailed in ISO/IEC 23001-7 (Common encryption in ISO base media file format files), not the overall common encryption scheme detailed in that spec, which is also, confusingly, known as cenc.
- The [encryption scheme used with webm](https://www.webmproject.org/docs/webm-encryption/) behaves similarly to cenc, so is included here.

Generating the encrypted media is done via the following, with shaka-packager:

- mp4: `packager-win in=big-buck-bunny-trailer-video.mp4,stream=video,output=big-buck-bunny-trailer-video-cenc.mp4, in=big-buck-bunny-trailer-audio.mp4,stream=audio,output=big-buck-bunny-trailer-audio-cenc.mp4 --protection_scheme cenc --enable_raw_key_encryption --keys label=:key_id=0123456789abcdef0123456789abcdef:key=fedcba9876543210fedcba9876543210`
- webm: `packager-win in=big-buck-bunny-trailer-video.webm,stream=video,output=big-buck-bunny-trailer-video-cenc.webm, in=big-buck-bunny-trailer-audio.webm,stream=audio,output=big-buck-bunny-trailer-audio-cenc.webm --protection_scheme cenc --enable_raw_key_encryption --keys label=:key_id=0123456789abcdef0123456789abcdef:key=fedcba9876543210fedcba9876543210`


### cbcs

Generating the encrypted media is done via the following:

- mp4: `packager-win in=big-buck-bunny-trailer-video.mp4,stream=video,output=big-buck-bunny-trailer-video-cbcs.mp4, in=big-buck-bunny-trailer-audio.mp4,stream=audio,output=big-buck-bunny-trailer-audio-cbcs.mp4 --protection_scheme cbcs --enable_raw_key_encryption --keys label=:key_id=0123456789abcdef0123456789abcdef:key=fedcba9876543210fedcba9876543210 -iv 11223344556677889900112233445566`
- webm doesn't support cbc style encryption.


# License

- Code is licensed per the Mozilla Public License Version 2.0.
- Big Buck Bunny is licensed under Creative Commons Attribution 3.0 - (c) copyright 2008, Blender Foundation / www.bigbuckbunny.org