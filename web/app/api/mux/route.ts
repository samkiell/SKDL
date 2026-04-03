import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import https from 'https'
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg'

// Force Node.js runtime for FFmpeg usage
export const runtime = 'nodejs'

const ffmpegPath = ffmpegInstaller.path

export async function POST(request: NextRequest) {
  try {
    const { videoUrl, subtitleUrl, filename } = await request.json()

    if (!videoUrl || !subtitleUrl || !filename) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }

    const tmpDir = os.tmpdir()
    const videoFile = path.join(tmpDir, `video_${Date.now()}.mp4`)
    const subtitleFile = path.join(tmpDir, `subs_${Date.now()}.srt`)
    const outputFile = path.join(tmpDir, `${filename}.mkv`)

    // Helper to download a file with spoofed headers to avoid 403s
    const downloadFile = (url: string, dest: string) => {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest)
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Referer': 'https://fmoviesunblocked.net/',
                'Origin': 'https://h5.aoneroom.com',
                'Accept': '*/*',
            }

            https.get(url, { headers }, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download ${url}: ${response.statusCode} ${response.statusMessage}`))
                    return
                }
                response.pipe(file)
                file.on('finish', () => {
                    file.close()
                    resolve(true)
                })
            }).on('error', (err) => {
                fs.unlink(dest, () => {})
                reject(err)
            })
        })
    }

    const hasSubs = subtitleUrl && subtitleUrl !== 'not_found'
    if (hasSubs) {
        console.info('[api/mux] downloading subtitles...', { subs: subtitleUrl })
        await downloadFile(subtitleUrl, subtitleFile)
    } else {
        console.info('[api/mux] no subtitles found, skipping sub muxing.')
    }
    
    console.info('[api/mux] starting streaming mux with ffmpeg...', { video: videoUrl, subs: hasSubs ? subtitleFile : 'none' })

    // Build headers string for FFmpeg
    const ffHeaders = [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer: https://fmoviesunblocked.net/',
        'Origin: https://h5.aoneroom.com',
    ].join('\r\n') + '\r\n'

    // Run FFmpeg command - Instant start via streaming input
    return new Promise<Response>((resolve) => {
        const ffmpegArgs = [
            '-headers', ffHeaders,
            '-i', videoUrl,
        ]

        if (hasSubs) {
            ffmpegArgs.push('-i', subtitleFile)
        }

        ffmpegArgs.push(
            '-map', '0:v',    // Map first input video
            '-map', '0:a',    // Map first input audio
        )

        if (hasSubs) {
            ffmpegArgs.push(
                '-map', '1:s',    // Map second input (SRT) subtitle
                '-c', 'copy',     // Stream copy both video and audio
                '-c:s', 'srt',     // Subtitle codec
                '-metadata:s:s:0', 'language=eng'
            )
        } else {
            ffmpegArgs.push('-c', 'copy')
        }

        ffmpegArgs.push(
            '-y',             // Overwrite output
            '-f', 'matroska', // Output format
            outputFile
        )

        const ffmpeg = spawn(ffmpegPath, ffmpegArgs)

        ffmpeg.stderr.on('data', (data) => {
            // Log one line only for progress to avoid cluttering but show activity
            const msg = data.toString()
            if (msg.includes('bitrate=') || msg.includes('frames=')) {
                console.log(`[ffmpeg]: ${msg.trim()}`)
            }
        })

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                console.error('[api/mux] ffmpeg failed with code', code)
                resolve(NextResponse.json({ error: 'FFmpeg muxing failed' }, { status: 500 }))
                return
            }

            console.info('[api/mux] mux complete, streaming back to client...', outputFile)

            const stat = fs.statSync(outputFile)
            const stream = fs.createReadStream(outputFile)

            // Cleanup temp files after stream finishes
            stream.on('close', () => {
                try {
                    // We only have the SRT and Output to clean up now
                    if (fs.existsSync(subtitleFile)) fs.unlinkSync(subtitleFile)
                    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile)
                    console.info('[api/mux] cleaned up temp files.')
                } catch (err) {
                    console.error('[api/mux] cleanup error:', err)
                }
            })

            const response = new NextResponse(stream as any, {
                status: 200,
                headers: {
                    'Content-Type': 'video/x-matroska',
                    'Content-Disposition': `attachment; filename="${filename}.mkv"`,
                    'Content-Length': stat.size.toString(),
                },
            })

            resolve(response)
        })
    })

  } catch (err: any) {
    console.error('Mux API caught error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
