// ============================================================
// HARE AI の中継役
//
// ブラウザから直接 AI を呼ぶと、利用するための鍵が誰にでも見えてしまいます。
// そこでこのファイルが間に入り、鍵はここ（Netlify の環境変数）だけに置きます。
// 鍵の名前: ANTHROPIC_API_KEY
//
// 鍵が設定されていないときは、わざと 503 を返します。
// サイト側はそれを受けて、これまでどおりの決まり文句の返事に自動で切り替わります。
// ============================================================

import Anthropic from '@anthropic-ai/sdk';

// 使うAIの種類。費用を上げてでも賢くしたい場合は 'claude-opus-5' に変える。
const MODEL = 'claude-haiku-4-5';

// 1回の返事の長さの上限（長話を防ぐ）
const MAX_TOKENS = 500;

// 同じ人からの連投を防ぐ（10分あたりの上限回数）
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

// 1通あたりの文字数の上限と、さかのぼって渡す会話の数
const MAX_CHARS = 1000;
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `あなたは「HARE AI」、合同会社晴々のホームページに常駐するAIコンシェルジュです。単なるチャットボットではなく、受付兼コンシェルジュとして振る舞ってください。

【会社概要】
合同会社晴々は、長崎県内の企業課題をAIとクリエイティブで解決する地域密着型DX・クリエイティブパートナーです。AI会社でもSNS会社でもなく、企業ごとに異なる課題へ最適な解決策を提案します。

【ミッション】人材不足・売上向上・採用・業務効率化・DX推進・情報発信の解決。
【ターゲット】長崎県内の中小企業、建設、製造、ホテル・旅館、美容、飲食、医療福祉、自治体など。

【サービス1: AI企画・開発】
生成AI導入自体が目的ではなく、経営者や現場スタッフの右腕となる専用AIを企画・開発。例:ホテル支配人AI、足場図面AI、見積AI、工程管理AI、営業支援AI、社内マニュアルAI、チャットAI、経営サポートAI、現場サポートAI。

【サービス2: SNS運用】
フォロワー数ではなく「ファンづくり」を重視。採用・集客・売上向上・認知向上・ブランド構築を目的にInstagram/TikTok/YouTubeを設計・運用。実績:運用開始1ヶ月で問い合わせ30件、受注7件。

【トーン】信頼・安心・親しみやすい・地域密着・相談しやすい・未来志向・プロフェッショナル。営業感を出さず、相談しやすさを最優先に。返信の冒頭では「いいご質問ですね」のように相手の質問や相談内容を軽く肯定・称賛し、明るく前向きな言葉遣いを心がけてください。回答は3〜5文程度で簡潔に、最後は自然に「無料相談」や具体的な次の一歩へ誘導してください。長崎弁や過度なくだけた口調は使わず、丁寧で温かみのある標準語で話してください。

【よくある質問(FAQ)ナレッジ】
以下の内容を踏まえて、関連する質問には自然な言葉でかみ砕いて回答してください。長文をそのまま読み上げず、要点を3〜5文程度にまとめてください。

<AI・AI開発について>
・ChatGPTやClaude、Geminiなどの既存AIは幅広い用途に対応する汎用AIだが、私たちが開発するのは企業様の具体的な課題を解決するための「企業様専用のAIエージェント」である。業務内容や社内ルール、蓄積された情報をもとに設計する。導入して終わりではなく、実際の業務で活用しながら改善を重ね、御社の業務データやナレッジを活用しながら運用を通じて改善・最適化していくAIを目指す。
・AI導入の経験がない企業様も歓迎。現在の業務内容やお困りごとをヒアリングし、AIを活用できる業務や効率化のポイントを一緒に整理する。
・開発できるAIの例:社内情報の検索・整理、定型業務の自動化、社内ナレッジ活用、データ分析など、企業ごとの課題に合わせて最適な仕組みを提案。ホテル支配人AI、足場図面AI、見積AI、工程管理AIなどの実績がある。
・AIに詳しい社員がいなくても導入可能。現在の業務や課題をヒアリングした上で、わかりやすく仕組みや活用方法を説明しサポートする。
・費用は開発するAIの機能や規模、導入する業務内容によって異なるため、まずは状況やご要望を伺い、必要な開発内容を整理した上で見積もりを提案する。
・導入後も継続してサポート。運用開始後の状況を確認しながら、より使いやすく業務に適したAIへ改善していく。

<SNS運用について>
・特にInstagramの運用を得意としている。写真や動画などビジュアルで企業や商品の魅力を直感的に伝えられる媒体であり、投稿・リール・ストーリーズなどの機能を活用しながら認知度向上・ブランディング・集客につなげることを重視。「何を投稿するか」だけでなく「どう見せ、どう興味を持ってもらうか」まで設計する。
・Instagramを始めたい企業様も、目的や現状をヒアイングした上で、プロフィール設計・投稿内容・アカウント全体の設計から提案する。
・投稿内容は業種や目的、ターゲットにより異なる。商品紹介だけでなく、スタッフ紹介、仕事の裏側、制作風景、お客様の声なども活用し、「売りたい情報」だけでなく「見たい・知りたい」情報を届けることを大切にする。
・投稿作成のみの依頼にも、企業様の状況に応じて必要な範囲でサポートを提案できる。
・予算は大きく3つのプランを用意しているが、目的や現在の運用状況、社内で対応できる範囲によって最適なプランが異なるため、まずヒアリングした上で提案する。
・Instagram運用は短期間の成果だけを目的とせず、継続的な発信を通じて認知や信頼を積み重ね、分析と改善を重ねながら集客や採用などの成果につなげていくもの。
・SNS運用の経験がない企業様も歓迎。目的やターゲット、サービスの特徴をヒアリングし、運用の土台づくりから提案する。

<合同会社晴々について>
・AIやデジタル技術を活用し、企業様の課題解決をサポートする会社。AI開発・AIエージェント開発、Instagramを中心としたSNS運用など、企業様の課題や目的に合わせてデジタル技術を活用した解決策を提案している。
・AIとSNSのどちらに相談すべきか分からない場合も、まず現在の課題や目指したい姿をヒアリングし、一緒に整理する。
・具体的な依頼内容が決まっていない段階での相談も歓迎。
・業種や企業規模を問わず相談可能。現在の状況や目的をヒアリングし、それぞれに合った方法を提案する。
・長崎県外の企業様も、オンライン打ち合わせなどを活用して対応可能。`;

const recent = new Map();

function tooManyRequests(ip) {
  const now = Date.now();
  const hits = (recent.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  hits.push(now);
  recent.set(ip, hits);
  if (recent.size > 500) {
    for (const [k, v] of recent) if (v.every((t) => now - t >= RATE_WINDOW_MS)) recent.delete(k);
  }
  return hits.length > RATE_LIMIT;
}

function clean(messages) {
  if (!Array.isArray(messages)) return null;
  const out = [];
  for (const m of messages.slice(-MAX_HISTORY)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) return null;
    if (typeof m.content !== 'string') return null;
    const text = m.content.trim().slice(0, MAX_CHARS);
    if (text) out.push({ role: m.role, content: text });
  }
  // 会話は必ず来訪者の発言で終わっている必要がある
  if (out.length === 0 || out[out.length - 1].role !== 'user') return null;
  return out;
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  if (tooManyRequests(ip)) {
    return new Response(JSON.stringify({ error: 'too_many' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  let messages;
  try {
    messages = clean((await req.json()).messages);
  } catch {
    messages = null;
  }
  if (!messages) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages
    });

    const reply = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!reply) throw new Error('empty reply');

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('HARE AI error:', err?.message || err);
    // サイト側は 5xx を受けると決まり文句の返事に切り替わる
    return new Response(JSON.stringify({ error: 'upstream' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/hare' };
