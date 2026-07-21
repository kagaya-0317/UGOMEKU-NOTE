# BGM Video Maker

Creates one YouTube-ready MP4 per audio file.

## Settings

The defaults are in `config.json`:

- 60 fps
- 10 frames per background image
- 2 audio loops
- `bgm_back1.png`, `bgm_back2.png`, `bgm_back3.png`
- H.264 video and AAC audio
- Output size follows the source background image size
- Supported audio: `.mp3`, `.ogg`

## Single Audio

```powershell
node .\make_bgm_video.mjs "C:\path\to\track.mp3" --dir "C:\path\to\Youtube"
```

```powershell
node .\make_bgm_video.mjs "C:\path\to\track.ogg" --dir "C:\path\to\Youtube"
```

## Multiple Audio Files

Each input audio file creates one MP4.

```powershell
node .\make_bgm_video.mjs "C:\path\to\track1.mp3" "C:\path\to\track2.ogg" --dir "C:\path\to\Youtube"
```

## Dry Run

Print the ffmpeg command without rendering.

```powershell
node .\make_bgm_video.mjs "C:\path\to\track.mp3" --dir "C:\path\to\Youtube" --dry-run
```
