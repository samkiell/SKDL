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

    console.info('[api/mux] downloading source files...', { video: videoUrl, subs: subtitleUrl })
    
    // Download SRT (always small)
    await downloadFile(subtitleUrl, subtitleFile)
    
    // For video, we could stream it or download it.
    // Given Railway's /tmp is limited, let's try to pass the URL directly to FFmpeg first.
    // If that fails, we can download it. 
    // Usually FFmpeg handles URLs well if headers are spoofed.
    // But the instructions said "Stream video to /tmp". 
    // I'll follow the instructions but note that large files might fill /tmp.
    
    // Wait, let's try to stream it to /tmp
    await downloadFile(videoUrl, videoFile)

    console.info('[api/mux] muxing files using ffmpeg...', { video: videoFile, subs: subtitleFile })

    // Run FFmpeg command
    // ffmpeg -i video.mp4 -i subs.srt -c copy -c:s srt output.mkv
    return new Promise<Response>((resolve) => {
        const ffmpeg = spawn(ffmpegPath, [
            '-i', videoFile,
            '-i', subtitleFile,
            '-c', 'copy',
            '-c:s', 'srt',
            '-y', // Overwrite output
            outputFile
        ])

        ffmpeg.stderr.on('data', (data) => {
            // FFmpeg logs to stderr
            console.log(`[ffmpeg logger]: ${data}`)
        })

        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                console.error('[api/mux] ffmpeg failed with code', code)
                resolve(NextResponse.json({ error: 'FFmpeg muxing failed' }, { status: 500 }))
                return
            }

            console.info('[api/mux] muxing complete, streaming back to client...', outputFile)

            const stat = fs.statSync(outputFile)
            const stream = fs.createReadStream(outputFile)

            // Cleanup temp files after stream finishes
            stream.on('close', () => {
                try {
                    fs.unlinkSync(videoFile)
                    fs.unlinkSync(subtitleFile)
                    fs.unlinkSync(outputFile)
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
