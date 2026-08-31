// header shrink
  const header = document.getElementById('siteHeader');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
    const h = document.body.scrollHeight - window.innerHeight;
    const pct = Math.min(100, Math.max(0, (window.scrollY / h) * 100));
    document.getElementById('clarityLine').style.backgroundPosition = `0 ${pct}%`;
  });

  // reveal on scroll
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // mobile hamburger menu
  const navToggle = document.getElementById('navToggle');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavOverlay = document.getElementById('mobileNavOverlay');

  function toggleMobileNav(open){
    const isOpen = open !== undefined ? open : !mobileNav.classList.contains('open');
    mobileNav.classList.toggle('open', isOpen);
    mobileNavOverlay.classList.toggle('open', isOpen);
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }
  navToggle.addEventListener('click', () => toggleMobileNav());
  mobileNavOverlay.addEventListener('click', () => toggleMobileNav(false));
  mobileNav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => toggleMobileNav(false)));

  // HARE AI concierge logic
  const panel = document.getElementById('harePanel');
  const fab = document.getElementById('hareFab');
  const messagesEl = document.getElementById('hareMessages');
  const inputEl = document.getElementById('hareInput');

  function openHare(){
    panel.classList.add('open');
    fab.style.display = 'none';
    inputEl.focus();
  }
  function closeHare(){
    panel.classList.remove('open');
    fab.style.display = 'flex';
  }
  function openHareWithQuestion(q){
    openHare();
    inputEl.value = q;
    sendHareMessage();
  }

  document.querySelectorAll('.hare-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      inputEl.value = chip.dataset.q;
      sendHareMessage();
    });
  });
  inputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) sendHareMessage(); });

  // 会社紹介やFAQの指示文は netlify/functions/hare.mjs（中継役）へ移しました。
  // ブラウザ側に置いても意味がなく、二重管理になるためです。


  function addMessage(text, who){
    const div = document.createElement('div');
    div.className = 'hare-msg ' + who;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addTyping(){
    const div = document.createElement('div');
    div.className = 'hare-msg bot typing-dots';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  // ------------------------------------------------------------------
  // HARE AIの回答
  //
  // ふだんは中継役(/api/hare)を通して本物のAIが答えます。
  // 鍵が未設定・混雑・通信エラーのときは、下の決まり文句の返事に自動で切り替わります。
  // つまり下のルールは「AIが使えないときの保険」です。消さないでください。
  // ------------------------------------------------------------------
  const COMPLIMENT_OPENERS = [
    'いいご質問ですね! ',
    'そこ、気になりますよね。よく聞かれます! ',
    'ご相談ありがとうございます、とても大切なポイントです。 ',
    '素敵な視点だと思います! ',
    'ちょうどよく聞かれる質問です、丁寧にお答えしますね。 '
  ];
  function pickCompliment(){
    return COMPLIMENT_OPENERS[Math.floor(Math.random() * COMPLIMENT_OPENERS.length)];
  }

  // ------------------------------------------------------------------
  // 質問の内容ごとの回答ルール
  //
  // 上から順に照合し、最初に当てはまったものを返します(順番に意味があります)。
  // topic は「どんな相談が多かったか」の集計用の名前です。
  // ルールを足すときは topic も必ず付けてください。
  // ------------------------------------------------------------------
  const HARE_RULES = [
    {
      topic: '料金・費用',
      test: t => t.includes('料金') || t.includes('費用') || t.includes('価格') || t.includes('いくら') || t.includes('予算'),
      answer: 'ご料金は、開発するAIの機能や規模、SNS運用の目的や運用範囲によって変わります。まずは現状やご要望を伺ったうえで、必要な内容を整理してお見積りをご提案しています。目安だけでもお伝えできますので、無料相談でお気軽にお尋ねください。'
    },
    {
      topic: '採用・求人',
      test: t => t.includes('採用情報') || t.includes('求人') || t.includes('採用してます') || (t.includes('採用') && (t.includes('募集') || t.includes('働き'))),
      answer: '採用情報ページは現在準備中です。晴々への採用に関するお問い合わせは、下記メールアドレス(harebare@harebare-llc.com)まで直接ご連絡いただけますと幸いです。'
    },
    {
      topic: 'どちらが合うか',
      test: t => t.includes('診断') || t.includes('合う') || t.includes('おすすめ') || t.includes('どっち') || t.includes('どちら'),
      answer: '御社の一番の課題は何でしょうか?「人材不足・属人化」「採用」「売上」「業務効率化・DX」のどれかを教えていただければ、AI企画・開発とSNS運用のどちらが合いそうか、簡単にご提案します。'
    },
    {
      topic: '初めてで不安',
      test: t => t.includes('経験がない') || t.includes('初めて') || t.includes('詳しくない') || t.includes('分からない') || t.includes('わからない'),
      answer: 'AI導入もSNS運用も、経験がない企業様のご相談がほとんどです。現在の業務内容やお困りごとをヒアリングし、何から始めればよいかを一緒に整理するところからスタートしますので、ご安心ください。'
    },
    {
      topic: 'AI企画・開発',
      test: t => t.includes('chatgpt') || t.includes('claude') || t.includes('gemini') || t.includes('汎用') || t.includes('生成ai') || (t.includes('ai') && (t.includes('開発') || t.includes('導入') || t.includes('企画'))),
      answer: 'ChatGPTやGeminiのような汎用AIとは違い、私たちがつくるのは御社の業務内容や社内ルールに合わせた「専用AIエージェント」です。ホテル支配人AI・足場図面AI・見積AIなどの開発実績があり、導入後も運用しながら改善を重ねていきます。AI開発の話を詳しく伺うなら、無料相談がおすすめです。'
    },
    {
      topic: 'SNS運用',
      test: t => t.includes('instagram') || t.includes('インスタ') || t.includes('tiktok') || t.includes('youtube') || t.includes('sns'),
      answer: '特にInstagram運用を得意としています。フォロワー数を追うのではなく「ファンづくり」を重視し、採用広報・集客・ブランディングなど目的から逆算してプロフィール設計から投稿・分析まで伴走します。経験がない企業様も、目的とターゲットのヒアリングから一緒に整理しますのでご安心ください。'
    },
    {
      topic: '対応エリア',
      test: t => t.includes('対応エリア') || t.includes('県外') || t.includes('長崎以外') || t.includes('オンライン'),
      answer: '長崎県内はもちろん、長崎県外の企業様もオンライン打ち合わせで対応可能です。業種や企業規模を問わず、まずは現状の課題や目指したい姿をお伺いします。'
    },
    {
      topic: '実績・事例',
      test: t => t.includes('実績') || t.includes('事例') || t.includes('効果'),
      answer: 'サービス業のお客様では、SNSを採用広報の窓口として設計し直し、運用開始1ヶ月で応募関連の反響30件・採用決定3件という実績があります。ホテル支配人AIや足場図面AIなど、業種特化の開発事例もページ内の「導入事例」でご紹介していますので、ぜひご覧ください。'
    },
    {
      topic: '会社について',
      test: t => t.includes('どんな会社') || t.includes('会社概要') || t.includes('会社について') || t.includes('晴々'),
      answer: '合同会社晴々は、長崎県内の企業課題をAIとクリエイティブで解決する地域密着型のパートナーです。AI会社でもSNS会社でもなく、企業ごとの課題に合わせて最適な手段をご提案しています。所在地やメールアドレスはページ下部の会社概要・フッターに記載しています。'
    },
    {
      topic: '無料相談',
      test: t => t.includes('無料相談') || t.includes('相談したい') || t.includes('問い合わせ') || t.includes('連絡'),
      answer: 'ありがとうございます。無料相談は契約を前提としたものではなく、まず現状のお悩みを伺うだけの場です。このままここでご相談内容を伺うことも、harebare@harebare-llc.com宛にメールをいただくことも可能です。'
    }
  ];

  const HARE_DEFAULT_ANSWER = 'ご質問ありがとうございます。もう少し詳しく——例えば「人材不足」「採用」「売上」「DX」「SNS運用」のどれに近いお悩みか教えていただけますか?最適なサービスをご案内します。お急ぎでしたらharebare@harebare-llc.comへ直接ご連絡いただいても大丈夫です。';

  function fallbackReply(q){
    const hit = HARE_RULES.find(rule => rule.test(q.toLowerCase()));
    return pickCompliment() + (hit ? hit.answer : HARE_DEFAULT_ANSWER);
  }

  // 集計用に、その質問がどのルールに当たったかを返す。
  // 「該当なし」が多い言葉は、まだHARE AIが答えられていない質問。
  function hareTopicOf(q){
    const hit = HARE_RULES.find(rule => rule.test(q.toLowerCase()));
    return hit ? hit.topic : '該当なし';
  }

  // ------------------------------------------------------------------
  // 中継役への問い合わせ
  //
  // 鍵が未設定なら中継役は503を返し、以降この訪問中は聞きに行きません
  // （毎回むだに待たされないようにするため）。
  // ------------------------------------------------------------------
  const HARE_API_URL = '/api/hare';
  let hareApiAvailable = true;

  async function askHareAI(history){
    if (!hareApiAvailable) return null;
    try {
      const res = await fetch(HARE_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history })
      });
      if (res.status === 429) return null;        // 連投しすぎ。今回だけ決まり文句で返す
      if (!res.ok) { hareApiAvailable = false; return null; }
      const data = await res.json();
      const reply = data && typeof data.reply === 'string' ? data.reply.trim() : '';
      return reply || null;
    } catch (e) {
      hareApiAvailable = false;
      return null;
    }
  }

  // ------------------------------------------------------------------
  // HARE AIに聞かれた内容の記録
  //
  // 下のURLは、Googleスプレッドシートに書き込むための受け皿(Google Apps Script)の
  // アドレスです。空のままなら記録は行われず、チャットはこれまでどおり動きます。
  // 記録するのは「聞かれた文章・振り分けた分類・見ていたページ」だけで、
  // 名前やメールアドレスをこちらから尋ねることはしていません。
  // 記録する旨は privacy.html に明記しています。
  // ------------------------------------------------------------------
  const HARE_LOG_URL = '';

  const hareSessionId = Math.random().toString(36).slice(2, 10);
  let hareTurn = 0;

  function logHareQuestion(question, topic, answeredBy){
    if (!HARE_LOG_URL) return;
    try {
      fetch(HARE_LOG_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          question: question.slice(0, 500),
          topic: topic,
          answeredBy: answeredBy,
          turn: ++hareTurn,
          session: hareSessionId,
          page: location.pathname
        })
      }).catch(() => {});
    } catch (e) {
      // 記録に失敗しても会話は止めない
    }
  }

  let hareHistory = [];

  async function sendHareMessage(){
    const text = inputEl.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    hareHistory.push({ role: 'user', content: text });
    inputEl.value = '';
    document.getElementById('hareQuick').style.display = 'none';

    const typingEl = addTyping();

    let reply = await askHareAI(hareHistory);
    const answeredBy = reply ? 'AI' : '決まり文句';
    if (!reply) {
      // 決まり文句のときは、実際に考えているような短い間を置く
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 400));
      reply = fallbackReply(text);
    }

    typingEl.remove();
    addMessage(reply, 'bot');
    hareHistory.push({ role: 'assistant', content: reply });
    logHareQuestion(text, hareTopicOf(text), answeredBy);
  }

// ------------------------------------------------------------------
// 企業診断ツール(ミッションページのみに存在。他ページでは何もしない)
// ------------------------------------------------------------------
(function () {
  const diagBtn = document.getElementById('diagBtn');
  if (!diagBtn) return;

  const CHALLENGE_ADVICE = {
    '人材不足・属人化': {
      service: 'AI企画・開発',
      text: 'ベテランの知識や勘に頼っている業務を、専用AIに引き継がせる方向性が合いそうです。若手でも一定水準の対応ができるようになり、教育負担も軽くなります。'
    },
    '受注・売上': {
      service: 'AI企画・開発とSNS運用の両方',
      text: '見積もりや工程管理などの業務をAIで効率化しつつ、SNSで新規のお客様との接点を増やす、両輪でのアプローチが合いそうです。'
    },
    '集客': {
      service: 'SNS運用',
      text: '「フォロワーを増やす」ことよりも、来店・問い合わせのきっかけになる"ファンづくり"を重視した発信設計が合いそうです。'
    },
    'PR・採用広報': {
      service: 'SNS運用',
      text: '求人媒体だけに頼らず、現場の雰囲気や働く人の表情が伝わる採用広報型のSNS発信に切り替えることで、「働きたい」という反応が増えていく可能性があります。'
    },
    '業務効率化・DX': {
      service: 'AI企画・開発',
      text: '「AI導入」を目的にするのではなく、まず現場のどの業務にAIを使えるかを一緒に整理するところから始める方向性が合いそうです。'
    },
    'SNS運用が続かない': {
      service: 'SNS運用',
      text: '更新が止まってしまう原因の多くは「何を投稿すればいいか分からない」ことにあります。目的とターゲットから逆算した投稿設計に見直す方向性が合いそうです。'
    }
  };

  const INDUSTRY_EXAMPLE = {
    '建設業': '足場図面AIのように、図面作成や工程管理を効率化するAI',
    '製造業': '見積AIや工程管理AIのように、現場のノウハウを仕組み化するAI',
    '宿泊業': 'ホテル支配人AIのように、接客対応の属人化を解消するAI',
    '飲食業': '常連客との関係を深めるSNS発信や、仕込み・発注の負担を減らすAI',
    '美容業': '予約・顧客管理の効率化や、来店のきっかけをつくるSNS発信',
    '医療福祉': '記録・情報共有の負担を減らす社内マニュアルAI',
    '自治体': '住民対応や情報発信を支えるチャットAI',
    'その他': '御社の業務内容に合わせたオーダーメイドのAI'
  };

  const USAGE_NOTE = {
    'まったく活用していない': '初めてのAI・SNS活用でも、ヒアリングから丁寧に伴走しますのでご安心ください。',
    '一部活用している': '既に一部活用されている強みを活かしつつ、活用範囲を広げていく形が合いそうです。',
    '本格的に活用したい': '本格的な活用をお考えとのことですので、優先順位を整理しながら段階的に進めていく設計をご提案できます。'
  };

  const GOAL_NOTE = {
    '売上・受注を増やしたい': '売上・受注アップが目的であれば、新規接点づくりと業務効率化の両面から考えるのがおすすめです。',
    '採用を強化したい': '採用強化が目的であれば、求人媒体に頼らない採用広報型のSNS発信が特に効果的です。',
    '業務を効率化したい': '業務効率化が目的であれば、まず現場のどの業務が負担になっているかを整理するところから始めましょう。',
    '認知度・ブランドを高めたい': '認知度・ブランド向上が目的であれば、"らしさ"が伝わる発信軸をつくることを重視します。'
  };

  const SIZE_NOTE = {
    '1〜5名': '少人数の体制でも無理なく続けられる範囲から設計します。',
    '6〜20名': '担当者お一人に負担が偏らないよう、運用しやすい体制も一緒に考えます。',
    '21〜50名': '部署をまたぐ情報共有や引き継ぎも見据えた仕組みづくりが可能です。',
    '51名以上': '複数拠点・部署がある場合も、優先度をつけながら段階的に導入できます。'
  };

  function freeTextInsight(text) {
    if (!text) return '';
    const t = text.toLowerCase();
    if (t.includes('人材') || t.includes('採用') || t.includes('引き継ぎ') || t.includes('退職')) {
      return 'いただいた内容から、特に「人」に関わる課題が大きいように感じます。属人化している業務の棚卸しから始めるとよさそうです。';
    }
    if (t.includes('売上') || t.includes('受注') || t.includes('単価')) {
      return '「売上・受注」に直結する仕組みづくりがポイントになりそうです。新規接点の増やし方から一緒に考えましょう。';
    }
    if (t.includes('集客') || t.includes('来店') || t.includes('問い合わせ')) {
      return '集客・問い合わせ数を増やすには、発信の"見せ方"の見直しが効果的なケースが多いです。';
    }
    if (t.includes('sns') || t.includes('インスタ') || t.includes('instagram') || t.includes('投稿')) {
      return 'SNS運用に関するお悩みは、目的とターゲットの再設計で改善するケースがよくあります。';
    }
    if (t.includes('コスト') || t.includes('予算') || t.includes('費用')) {
      return '費用面が気になる場合も、まずは小さく始められる範囲からご提案しますのでご安心ください。';
    }
    return 'いただいた具体的な内容も踏まえて、無料相談でさらに詳しくお伺いできればと思います。';
  }

  diagBtn.addEventListener('click', () => {
    const industry = document.getElementById('diagIndustry').value;
    const size = document.getElementById('diagSize').value;
    const usage = document.getElementById('diagUsage').value;
    const goal = document.getElementById('diagGoal').value;
    const challenge = document.getElementById('diagChallenge').value;
    const freeText = document.getElementById('diagFree').value.trim();

    const advice = CHALLENGE_ADVICE[challenge];
    const example = INDUSTRY_EXAMPLE[industry];

    const parts = [
      `${industry}様(${size})で「${challenge}」がお悩みとのこと、ありがとうございます。`,
      `晴々では${advice.service}を軸に、${example}のようなご提案が考えられます。`,
      advice.text,
      GOAL_NOTE[goal],
      USAGE_NOTE[usage],
      SIZE_NOTE[size],
    ];
    if (freeText) {
      parts.push(freeTextInsight(freeText));
    }
    parts.push('あくまで簡易診断のため、実際にはヒアリングのうえで最適な形をご提案します。');

    const resultText = parts.filter(Boolean).join('');

    const resultEl = document.getElementById('diagResult');
    document.getElementById('diagResultText').textContent = resultText;
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
})();

// お問い合わせフォームの「ご相談内容」をURLパラメータで事前選択(例: contact.html?topic=共同開発・共創について)
(function () {
  const topicSelect = document.getElementById('topic');
  if (!topicSelect) return;

  const params = new URLSearchParams(window.location.search);
  const topic = params.get('topic');
  if (!topic) return;

  for (const opt of topicSelect.options) {
    if (opt.value === topic) {
      topicSelect.value = topic;
      break;
    }
  }
})();
