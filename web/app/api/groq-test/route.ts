import { NextResponse } from 'next/server'
import { Groq } from 'groq-sdk'

export async function GET() {
  const apiKey = process.env.GROQ_API_KEY
  
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY not found in env' }, { status: 400 })
  }

  const groq = new Groq({ apiKey })

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Say hello!' }],
      model: 'openai/gpt-oss-120b',
    })

    return NextResponse.json({
      success: true,
      message: completion.choices[0].message.content,
      keyUsed: `${apiKey.slice(0, 10)}...${apiKey.slice(-5)}`
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.response?.data || error
    }, { status: 500 })
  }
}
