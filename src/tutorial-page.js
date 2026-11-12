// tutorial-page.js — Tutorial Page with Japanese/English toggle
import {
  cielab2nlrgb,
  simPBrettel,
  simDBrettel,
  simTBrettel,
  judgeInout,
} from './colormath.js';

const $ = (sel) => document.querySelector(sel);

let currentLang = 'ja';

// ===== Tutorial content (bilingual) =====
const CONTENT = {
  ja: {
    sections: [
      {
        id: 'why-matters',
        icon: '⚠️',
        title: 'カラーマップが科学を左右する',
        body: `
          <p>カラーマップの選択は、データの解釈を大きく左右します。<strong>データの違いを正しく伝えないカラーマップは、実際にはない模様を作り出したり、大切な特徴を見えにくくしたりします。</strong></p>
          <h3>Jet vs Viridis — 同じデータの全く異なる印象</h3>
          <p>下のデモは同一の数値データを Jet（悪い例）と Viridis（良い例）で色付けしたものです。</p>
          <div class="tutorial-figure">
            <div class="colormap-compare-grid" id="tutorialCompareDemo">
              <div class="compare-item">
                <div class="compare-badge compare-bad">問題あり</div>
                <div class="compare-label">Jet（従来型）</div>
                <canvas id="compareJetCanvas" class="tutorial-canvas-wide" height="140"></canvas>
                <p class="tutorial-caption">偽の輪郭線（疑似輝点）が現れる。データに存在しない境界が強調される。</p>
              </div>
              <div class="compare-item">
                <div class="compare-badge compare-good">推奨</div>
                <div class="compare-label">Viridis（知覚均一型）</div>
                <canvas id="compareViridisCanvas" class="tutorial-canvas-wide" height="140"></canvas>
                <p class="tutorial-caption">明度が単調増加し、データの連続的な変化を正確に伝える。</p>
              </div>
            </div>
            <p class="tutorial-caption">↑ 同一の2Dガウス分布データ。Jet では等高線のような偽パターンが出現。</p>
          </div>
          <h3>Jet の問題点</h3>
          <ul>
            <li><strong>知覚的不均一性</strong>: 等間隔の数値変化が等間隔の色変化に見えない。黄〜緑の遷移が突出して見える。</li>
            <li><strong>偽輪郭の発生</strong>: 鋭い色変化（青→シアン、緑→黄など）が存在しないエッジとして知覚される。</li>
            <li><strong>CVD 非対応</strong>: P型・D型の色覚特性を持つ方には緑と赤の区別がほぼ不可能。</li>
          </ul>
          <div class="insight-box">
            Jet の使用は非推奨とされており、知覚均一なカラーマップへの移行が推奨されています。
          </div>
        `,
      },
      {
        id: 'what-is-colormap',
        icon: '🎨',
        title: 'カラーマップとは',
        body: `
          <p>カラーマップとは、<strong>数値データを色に変換するための関数</strong>です。科学的可視化において、温度分布や標高データ、MRI画像などの数値を直感的に理解するために使われます。</p>
          <div class="tutorial-figure">
            <canvas id="tutorialColormapDemo" class="tutorial-canvas-wide" height="60"></canvas>
            <p class="tutorial-caption">↑ 数値 0〜255 を色にマッピングした例（Turbo カラーマップ）</p>
          </div>
          <h3>L*a*b* 色空間</h3>
          <p>Colormap Studio では、色を <strong>CIELAB（L*a*b*）色空間</strong> で扱います。</p>
          <ul>
            <li><strong>L*</strong>: 明度（0 = 黒、100 = 白）</li>
            <li><strong>a*</strong>: 赤-緑 方向の色度</li>
            <li><strong>b*</strong>: 黄-青 方向の色度</li>
          </ul>
          <p>CIELAB は人間の知覚に基づいた色空間であり、色の違いを均一に測定できるため、カラーマップの設計に適しています。</p>
          <div class="tutorial-figure">
            <canvas id="tutorialGamutDemo" class="tutorial-canvas-square" width="280" height="280"></canvas>
            <p class="tutorial-caption">↑ a*-b* 平面上の色域（L* = 50 の場合）</p>
          </div>
        `,
      },
      {
        id: 'cvd',
        icon: '👁️',
        title: '色覚多様性（CVD）',
        body: `
          <p>全人口の約8%（男性）が色覚特性（Color Vision Deficiency, CVD）を持っています。カラーマップを設計する際には、CVD を持つ方にも情報が正しく伝わるよう配慮する必要があります。</p>
          <h3>CVD の3類型</h3>
          <div class="cvd-types-grid">
            <div class="cvd-type-card cvd-p-card">
              <h4>P型（Protan）</h4>
              <p>赤色の感度が低い。赤と緑の区別が困難になる場合があります。</p>
            </div>
            <div class="cvd-type-card cvd-d-card">
              <h4>D型（Deutan）</h4>
              <p>緑色の感度が低い。最も一般的な CVD タイプで、赤緑の区別が困難です。</p>
            </div>
            <div class="cvd-type-card cvd-t-card">
              <h4>T型（Tritan）</h4>
              <p>青色の感度が低い。比較的まれですが、青と黄の区別が困難になります。</p>
            </div>
          </div>
          <div class="insight-box">
            Colormap Studio のシミュレーションと最適化は、P型・D型・T型の <strong>2 色覚</strong>（3 種類の錐体のうち 1 種類がはたらかない場合）の見え方をもとにしています。
          </div>
          <h3>CVD シミュレーション体験</h3>
          <p>以下の画像で、各 CVD タイプでどのように見えるかを確認できます。</p>
          <div class="tutorial-cvd-demo" id="tutorialCvdDemo">
            <div class="cvd-demo-card">
              <div class="cvd-demo-label">通常の色覚</div>
              <canvas id="cvdDemoNormal" class="cvd-demo-canvas"></canvas>
            </div>
            <div class="cvd-demo-card">
              <div class="cvd-demo-label cvd-label-p">P型シミュレーション</div>
              <canvas id="cvdDemoP" class="cvd-demo-canvas"></canvas>
            </div>
            <div class="cvd-demo-card">
              <div class="cvd-demo-label cvd-label-d">D型シミュレーション</div>
              <canvas id="cvdDemoD" class="cvd-demo-canvas"></canvas>
            </div>
            <div class="cvd-demo-card">
              <div class="cvd-demo-label cvd-label-t">T型シミュレーション</div>
              <canvas id="cvdDemoT" class="cvd-demo-canvas"></canvas>
            </div>
          </div>
        `,
      },
      {
        id: 'methods',
        icon: '🧭',
        title: '2 つの手法：均等性と整合性',
        body: `
          <p>Generator タブ左上の「Method」で、目的に合わせて 2 つの手法を選べます。どちらが優れているということはなく、<strong>評価の軸が違う</strong>ので、使う場面に応じて使い分けます。選んでいる手法は、「Method」のトグル、パネル上端の色（均等性＝青紫、整合性＝ピンク）、スコア表示の見出し、Optimize ボタンの表記で確認できます。</p>
          <table class="param-table">
            <thead><tr><th></th><th>均等性（Uniformity）</th><th>整合性（Consistency）</th></tr></thead>
            <tbody>
              <tr><td>目指すこと</td><td>隣り合う色の差をそろえる</td><td>元のカラーマップが持つ色差のパターンを保ったまま、色覚特性でも見え方が食い違わないようにする</td></tr>
              <tr><td>向く場面</td><td>色差に特別な意味がなく、どこも同じ刻みで見えるカラーマップがほしいとき</td><td>海と陸を区別するために一部の色差を意図的に大きくした、のように、色差のパターンに意味があるカラーマップを色覚に配慮したものにしたいとき</td></tr>
              <tr><td>出発点</td><td>プリセット／Custom／アップロード</td><td>既存のカラーマップ（研究用マップ・プリセット・アップロード）。Custom はありません</td></tr>
              <tr><td>代表色の位置</td><td>等間隔</td><td>色差が等しくなる位置（等間隔ではありません）</td></tr>
              <tr><td>評価項</td><td>U（均等性）、Q（コントラスト）、S（滑らかさ）</td><td>F（整合性）、Q、S</td></tr>
              <tr><td>重みの初期値</td><td>w<sub>u</sub> = 0.1、w<sub>q</sub> = 0.7</td><td>w<sub>f</sub> = 0.1、w<sub>q</sub> = 0.8</td></tr>
              <tr><td>色覚タイプ</td><td>0 個でも実行できる</td><td>1 つ以上の選択が必須</td></tr>
            </tbody>
          </table>
          <h3>目的関数（良し悪しを測るものさし）</h3>
          <p>最適化では、次の E を小さくするように色を調整します。E は 3 つの項の重み付き和で、手法によって最初の項だけが違い、Q と S は共通です。</p>
          <div class="formula-card">
            <div class="math-display">均等性：E = w<sub>u</sub>U + w<sub>q</sub>Q + w<sub>s</sub>S</div>
            <div class="math-display">整合性：E = w<sub>f</sub>F + w<sub>q</sub>Q + w<sub>s</sub>S</div>
            <div class="math-note">（w<sub>s</sub> = 1 − w<sub>u</sub> − w<sub>q</sub>、整合性では 1 − w<sub>f</sub> − w<sub>q</sub>）</div>
          </div>
          <ul>
            <li><strong>U（均等性スコア）</strong>: 隣り合う色の見た目の差がそろっているかを評価します。
              <ul>
                <li>隣接スロット間の ΔE の変動係数（標準偏差÷平均）を最小化します。</li>
              </ul>
            </li>
            <li><strong>F（整合性スコア）</strong>: 元のカラーマップの色差のパターンが、色覚特性のもとでも保たれているかを評価します。
              <div class="formula-card">
                <div class="math-note">F = (1 − 0.05) · (Σ<sub>c</sub> σ<sub>c</sub>) / |C| + 0.05 · F̂</div>
              </div>
              <ul>
                <li><strong>σ<sub>c</sub></strong>: 色覚タイプ c ごとに、「隣り合う色の差（色覚特性での見え方）÷（通常の見え方）」の比を計算し、そのばらつき（標準偏差）を求めたもの。比が場所によらず一定なら 0 で、通常の見え方での色差のパターンが、色覚特性のもとでも相似に保たれていることを表します。</li>
                <li><strong>F̂</strong>: 元のカラーマップの隣り合う色差からの平均的なずれ（ΔE<sub>00</sub>）。小さいほど、元の色差のパターンに近いことを表します。</li>
                <li><strong>|C|</strong>: 選んだ色覚タイプの数。F は色覚タイプごとの見え方を比べるため、1 つ以上選ぶ必要があります。</li>
              </ul>
            </li>
            <li><strong>Q（コントラスト確保項）</strong>: すべての色の組み合わせで、色覚特性のもとでも区別できるかを評価します。
              <ul>
                <li>色差が目標値（通常の見え方の色差の半分、最大 30）を下回らないように重み付けして評価します。</li>
              </ul>
            </li>
            <li><strong>S（滑らかさ）</strong>: カラーマップが Lab 空間で描く経路の滑らかさ（向きの変化の小ささ）を評価します。</li>
          </ul>
          <div class="insight-box">
            整合性では、選んだカラーマップ（256 色）から、色差が等しくなる位置に 15 色が取り出されます。生成後のスコアは、256 色に展開したカラーマップを 8 点おき＋最後の点で測り、F は元のカラーマップの同じ点での色差と比べます。
          </div>
        `,
      },
      {
        id: 'optimization',
        icon: '⚡',
        title: '最適化のしくみ',
        body: `
          <p>Colormap Studio は <strong>焼きなまし法（Simulated Annealing, SA）</strong> を使って、CVD に配慮したカラーマップを自動生成します。</p>
          <p>色の良し悪しを測る目的関数 E（U または F、Q、S の重み付き和）は、前の「2 つの手法」で説明しています。ここでは、E を小さくする色をどう探すかを説明します。</p>
          <h3>主要パラメータ</h3>
          <table class="param-table">
            <thead><tr><th>パラメータ</th><th>説明</th><th>デフォルト</th></tr></thead>
            <tbody>
              <tr><td>u_WEIGHT / f_WEIGHT</td><td>均等性 U（整合性では F）をどれだけ重視するか（w<sub>u</sub>、w<sub>f</sub>）</td><td>0.1</td></tr>
              <tr><td>q_WEIGHT</td><td>コントラスト Q をどれだけ重視するか（w<sub>q</sub>）。残り（1 から 2 つの重みを引いた分）が滑らかさ S の重みになります</td><td>0.7（均等性）／0.8（整合性）</td></tr>
              <tr><td>S1_WEIGHT</td><td>滑らかさ S の計算で使う係数</td><td>1.0</td></tr>
              <tr><td>R</td><td>★ の付いた色（指定色）が、選んだ色からどのくらい離れてよいかの目安（色差 ΔE）。小さいほど元の色を保ちます</td><td>7.0</td></tr>
              <tr><td>R′</td><td>★ のない色についての同じ目安。大きいほど自由に動きます</td><td>10.0</td></tr>
              <tr><td>T_init / T_end</td><td>探索の「温度」の開始値と終了値。温度が高いあいだは、悪くなる変更も受け入れて広く探します</td><td>1.0 / 0.0001</td></tr>
              <tr><td>Alpha</td><td>温度を下げる割合（段階ごとにこの値を掛けます）</td><td>0.925</td></tr>
              <tr><td>Iterations</td><td>1 つの温度で試す回数。多いほど時間はかかりますが、ていねいに探します</td><td>5500</td></tr>
              <tr><td>Seed</td><td>乱数の種。同じ設定で同じ種を入れると、同じ結果を再現できます</td><td>空欄（毎回変わる）</td></tr>
            </tbody>
          </table>
          <h3>SAのプロセス</h3>
          <div class="sa-steps">
            <div class="sa-step">
              <div class="sa-step-num">1</div>
              <div class="sa-step-text">画面に並んでいる色からスタート</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">2</div>
              <div class="sa-step-text">ランダムに1色を選び、L*a*b*空間内で微小摂動を加える</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">3</div>
              <div class="sa-step-text">E が改善されたら採用。悪化しても確率的に採用（温度に依存）</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">4</div>
              <div class="sa-step-text">温度を徐々に下げながらステップ 2–3 を繰り返す</div>
            </div>
          </div>
        `,
      },
      {
        id: 'how-to-use',
        icon: '📖',
        title: '使い方ガイド',
        body: `
          <p>Colormap Studio は、色覚の多様性に配慮したカラーマップを自動で作るサイトです。操作は Generator タブで行います。</p>
          <div class="quick-start">
            <div class="quick-start-title">最短の 3 ステップ</div>
            <ol>
              <li><strong>Preset colormap</strong> で、もとにする配色を選ぶ</li>
              <li><strong>Optimize</strong> を押して、数秒〜数十秒待つ</li>
              <li><strong>Export</strong> で保存する</li>
            </ol>
            <p>これだけで使えるカラーマップができます。色を自分で決めたい、手持ちのカラーマップを直したい、といった場合は、下の手順を必要なところだけ読んでください。</p>
          </div>
          <div class="tutorial-figure">
            <div class="ui-map" role="img" aria-label="Generator 画面の見取り図">
              <div class="ui-map-nav"><span class="ui-map-tab on">Generator</span><span class="ui-map-tab">Test<b class="ui-badge">5</b></span><span class="ui-map-tab">Tutorial</span></div>
              <div class="ui-map-body">
                <div class="ui-map-left">
                  <div class="ui-map-box"><span class="ui-map-cap">Method</span><span class="ui-map-seg"><i class="on">Uniformity</i><i>Consistency</i></span><b class="ui-badge">1</b></div>
                  <div class="ui-map-box"><span class="ui-map-cap">Preset colormap</span><span class="ui-map-select">Viridis ▾</span><b class="ui-badge">1</b></div>
                  <div class="ui-map-box"><span class="ui-map-cap">CVD types</span><span class="ui-map-chips"><i>P-type</i><i>D-type</i><i class="off">T-type</i></span><b class="ui-badge">3</b></div>
                  <div class="ui-map-box ui-map-optimize"><span class="ui-map-btn">Optimize</span><b class="ui-badge">4</b></div>
                </div>
                <div class="ui-map-right">
                  <div class="ui-map-box"><span class="ui-map-cap">Colors of the colormap</span><span class="ui-map-strip"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b class="ui-badge">2</b></div>
                  <div class="ui-map-box"><span class="ui-map-cap">Colormap preview / CVD simulation</span><span class="ui-map-bar"></span><span class="ui-map-bar ui-map-bar2"></span></div>
                  <div class="ui-map-box"><span class="ui-map-cap">Export</span><span class="ui-map-exports"><i>⬇ JSON</i><i>⬇ CSV</i><i>⬇ PNG</i><i>⬇ Python</i></span><b class="ui-badge">6</b></div>
                </div>
              </div>
            </div>
            <p class="tutorial-caption">↑ Generator 画面の見取り図。丸い番号は、下の手順 1〜6 で操作する場所です。</p>
          </div>
          <div class="guide-steps">
            <div class="guide-step">
              <div class="guide-step-icon">1</div>
              <div class="guide-step-content">
                <h4>手法と、もとにする配色を選ぶ</h4>
                <ul>
                  <li><strong>Method</strong>：ふつうは <strong>Uniformity（均等性）</strong>のままで構いません。どこも同じ刻みで色が変わるカラーマップになります。</li>
                  <li>海と陸の境目のように、もとのカラーマップの「色の変わり方」に意味があり、それを保ちたいときは <strong>Consistency（整合性）</strong>を選びます。</li>
                  <li><strong>Preset colormap</strong>：もとにする配色を一覧から選びます。</li>
                  <li><strong>自分のカラーマップを使う</strong>：一覧の「Upload colormap (image / CSV)…」を選び、横長のカラーマップ画像（PNG・JPEG・BMP・PPM）か、RGB または L*a*b* の CSV を読み込みます。ファイルはブラウザの中だけで処理され、サーバーには送信されません。</li>
                  <li><strong>一から作る</strong>：一覧の「Custom」を選ぶと、両端の色だけが置かれた状態から始められます（Uniformity のみ）。</li>
                </ul>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">2</div>
              <div class="guide-step-content">
                <h4>色を決める（そのままでよければ飛ばして構いません）</h4>
                <ul>
                  <li>画面中央の 15 個の四角が、カラーマップが通っていく色です。</li>
                  <li>四角をクリックすると色を選ぶパネルが開きます。色を選んで <strong>Apply</strong> を押すと確定します。</li>
                  <li><strong>★ は「指定色」のしるし</strong>です。色を置くと自動で付き、最適化のあともその色の近くに保たれます。</li>
                  <li>四角を<strong>右クリック</strong>すると ★ を外せます。★ のない色は出発点として使われるだけで、最適化でより大きく動いて構わない色になります。「この数色だけは守りたい」というときは、それ以外の ★ を外してください。</li>
                  <li>四角の右上の <strong>✕</strong> で色を消せます。空の四角は、両隣の色から自動でつながります（Consistency では消せません）。</li>
                  <li>両端（0 番と 14 番）には必ず色を置いてください。</li>
                </ul>
                <div class="ui-map ui-map-inline" role="img" aria-label="色の四角の例">
                  <span class="ui-map-strip ui-map-strip-demo"><i class="star"></i><i class="star"></i><i class="none"></i><i class="none"></i><i class="star"></i><i class="none"></i><i></i><i class="none"></i><i class="star"></i><i class="star"></i></span>
                  <span class="ui-map-note">★＝指定色（近くに保つ）／★なし＝大きく動いてよい／点線＝空（自動でつながる）</span>
                </div>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">3</div>
              <div class="guide-step-content">
                <h4>配慮する色覚タイプを選ぶ</h4>
                <ul>
                  <li><strong>CVD types</strong> で、配慮したいタイプにチェックを入れます。迷ったら P-type と D-type の両方で構いません。</li>
                  <li>チェックしたタイプでの見え方が、プレビューの下にすぐ表示されます。</li>
                  <li>Consistency では 1 つ以上のチェックが必要です。</li>
                </ul>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">4</div>
              <div class="guide-step-content">
                <h4>Optimize を押す</h4>
                <ul>
                  <li><strong>Optimize</strong> を押すと自動調整が始まり、数秒〜数十秒で終わります。</li>
                  <li>終わると、各プレビューの下に<strong>最適化前のカラーマップ</strong>（Before optimization）が並びます。</li>
                  <li>スコアは「最適化前 → 最適化後」の形で表示されます。<strong>どの数値も小さいほど良い</strong>ことを表します。それぞれの数値にマウスを置くと説明が出ます。</li>
                  <li>結果は実行のたびに少し変わります。気に入らなければ、もう一度押すか、色を直してから押してください。</li>
                  <li>同じ結果をもう一度作りたいときは、スコアの下に表示される seed の数を「Advanced parameters」の「Seed」に入れて実行します。</li>
                </ul>
                <div class="ui-map ui-map-inline" role="img" aria-label="最適化後の表示の例">
                  <span class="ui-map-cap">Colormap preview</span><span class="ui-map-bar"></span>
                  <span class="ui-map-note">Before optimization</span><span class="ui-map-bar ui-map-bar-before"></span>
                  <span class="ui-map-score">E · Uniformity: <span class="dim">0.07804 →</span> 0.04433</span>
                  <span class="ui-map-note">上が最適化後、下が最適化前。スコアは「前 → 後」。</span>
                </div>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">5</div>
              <div class="guide-step-content">
                <h4>Test タブで実際の見え方を確かめる</h4>
                <ul>
                  <li>上の <strong>Test</strong> タブを開くと、サンプルのデータや画像にカラーマップを当てはめた一覧が出ます。</li>
                  <li>見たいものをクリックすると拡大され、通常の見え方と、各色覚タイプでの見え方が横に並びます。</li>
                  <li>左の「Colormap」が「Current (from Generator)」なら、いま作っているカラーマップです。Jet や Viridis などに切り替えて見比べることもできます。</li>
                  <li>画像の上にマウスを置くと、その場所の値と色が左下に表示されます。</li>
                  <li><strong>見るポイント</strong>：データにない縞や境目が見えていないか。色覚タイプの画像で、区別できていた部分がつぶれていないか。</li>
                </ul>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">6</div>
              <div class="guide-step-content">
                <h4>保存する</h4>
                <ul>
                  <li><strong>PNG</strong>：帯状の画像。資料やスライドに貼るとき。</li>
                  <li><strong>CSV</strong>：256 色の数値の一覧。Excel などで開けます。</li>
                  <li><strong>JSON</strong>：他のプログラムで読み込むためのデータ。</li>
                  <li><strong>Python (matplotlib)</strong>：matplotlib でそのまま使えるファイル（colormap.py）。自分のプログラムと同じフォルダに置き、<code>from colormap import cmap</code> と書いて <code>plt.imshow(data, cmap=cmap)</code> のように使います。</li>
                  <li>JSON と Python のファイルには、作成時の条件（手法、もとの配色、色覚タイプ、設定値、seed、スコア）も記録されます。論文などで作成条件を示すときに使えます。</li>
                  <li>このサイトで作ったカラーマップは、出典の表記なしで自由に使えます。</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="insight-box">
            <strong>うまくいかないとき</strong>
            <ul>
              <li>Optimize が始まらない：両端（0 番と 14 番）に色があるか確認してください。Consistency では、色覚タイプを 1 つ以上選び、15 個すべてに色が必要です。</li>
              <li>最初からやり直したい：Preset colormap を選び直すと、すべて元に戻ります。</li>
              <li>色があまり変わらない：★ の付いた色は元の色の近くに保たれます。動かしてよい色は右クリックで ★ を外してください。</li>
            </ul>
          </div>
        `,
      },
    ],
  },
  en: {
    sections: [
      {
        id: 'why-matters',
        icon: '⚠️',
        title: 'Why Colormaps Shape Science',
        body: `
          <p>The choice of colormap profoundly affects how data is interpreted. <strong>A colormap that misrepresents differences in the data shows you patterns that aren't there and hides the ones that are.</strong></p>
          <h3>Jet vs Viridis — The Same Data, Two Different Stories</h3>
          <p>The demo below shows identical numerical data rendered with Jet (problematic) and Viridis (recommended).</p>
          <div class="tutorial-figure">
            <div class="colormap-compare-grid" id="tutorialCompareDemo">
              <div class="compare-item">
                <div class="compare-badge compare-bad">Problematic</div>
                <div class="compare-label">Jet (Legacy)</div>
                <canvas id="compareJetCanvas" class="tutorial-canvas-wide" height="140"></canvas>
                <p class="tutorial-caption">False contour lines appear. Boundaries that don't exist in the data are emphasized.</p>
              </div>
              <div class="compare-item">
                <div class="compare-badge compare-good">Recommended</div>
                <div class="compare-label">Viridis (Perceptually Uniform)</div>
                <canvas id="compareViridisCanvas" class="tutorial-canvas-wide" height="140"></canvas>
                <p class="tutorial-caption">Lightness increases monotonically, faithfully conveying continuous data variation.</p>
              </div>
            </div>
            <p class="tutorial-caption">↑ Same 2D Gaussian data. Jet produces phantom contours; Viridis does not.</p>
          </div>
          <h3>Why Jet Misleads</h3>
          <ul>
            <li><strong>Perceptual non-uniformity</strong>: Equal numeric steps don't appear as equal color steps. The yellow-green transition is especially prominent.</li>
            <li><strong>False contours</strong>: Sharp color transitions (blue→cyan, green→yellow) are perceived as edges that don't exist in the data.</li>
            <li><strong>CVD inaccessible</strong>: For people with P-type or D-type CVD, red and green are nearly indistinguishable.</li>
          </ul>
          <div class="insight-box">
            The use of Jet is widely considered non-recommended; transitioning to perceptually uniform colormaps is strongly advised.
          </div>
        `,
      },
      {
        id: 'what-is-colormap',
        icon: '🎨',
        title: 'What is a Colormap?',
        body: `
          <p>A colormap is a <strong>function that maps numerical data to colors</strong>. In scientific visualization, it is used to intuitively understand data such as temperature distributions, elevation data, and MRI images.</p>
          <div class="tutorial-figure">
            <canvas id="tutorialColormapDemo" class="tutorial-canvas-wide" height="60"></canvas>
            <p class="tutorial-caption">↑ Mapping values 0–255 to colors (Turbo colormap)</p>
          </div>
          <h3>L*a*b* Color Space</h3>
          <p>Colormap Studio uses the <strong>CIELAB (L*a*b*) color space</strong> to handle colors.</p>
          <ul>
            <li><strong>L*</strong>: Lightness (0 = black, 100 = white)</li>
            <li><strong>a*</strong>: Red-Green chromaticity axis</li>
            <li><strong>b*</strong>: Yellow-Blue chromaticity axis</li>
          </ul>
          <p>CIELAB is a perceptually-based color space where perceived color differences are approximately uniform, making it ideal for colormap design.</p>
          <div class="tutorial-figure">
            <canvas id="tutorialGamutDemo" class="tutorial-canvas-square" width="280" height="280"></canvas>
            <p class="tutorial-caption">↑ Color gamut on the a*-b* plane (L* = 50)</p>
          </div>
        `,
      },
      {
        id: 'cvd',
        icon: '👁️',
        title: 'Color Vision Deficiency (CVD)',
        body: `
          <p>About 8% of men have some form of color vision deficiency (CVD). A colormap should carry its information to them as well.</p>
          <h3>Three Types of CVD</h3>
          <div class="cvd-types-grid">
            <div class="cvd-type-card cvd-p-card">
              <h4>P-type (Protan)</h4>
              <p>Reduced sensitivity to red light. May have difficulty distinguishing red from green.</p>
            </div>
            <div class="cvd-type-card cvd-d-card">
              <h4>D-type (Deutan)</h4>
              <p>Reduced sensitivity to green light. The most common CVD type, with difficulty in red-green discrimination.</p>
            </div>
            <div class="cvd-type-card cvd-t-card">
              <h4>T-type (Tritan)</h4>
              <p>Reduced sensitivity to blue light. Relatively rare, with difficulty distinguishing blue from yellow.</p>
            </div>
          </div>
          <div class="insight-box">
            Colormap Studio simulates and optimizes for <strong>dichromacy</strong> of the P, D and T types, where one of the three kinds of cone does not work.
          </div>
          <h3>CVD Simulation Experience</h3>
          <p>See how each CVD type perceives the same image below.</p>
          <div class="tutorial-cvd-demo" id="tutorialCvdDemo">
            <div class="cvd-demo-card">
              <div class="cvd-demo-label">Normal Vision</div>
              <canvas id="cvdDemoNormal" class="cvd-demo-canvas"></canvas>
            </div>
            <div class="cvd-demo-card">
              <div class="cvd-demo-label cvd-label-p">P-type Simulation</div>
              <canvas id="cvdDemoP" class="cvd-demo-canvas"></canvas>
            </div>
            <div class="cvd-demo-card">
              <div class="cvd-demo-label cvd-label-d">D-type Simulation</div>
              <canvas id="cvdDemoD" class="cvd-demo-canvas"></canvas>
            </div>
            <div class="cvd-demo-card">
              <div class="cvd-demo-label cvd-label-t">T-type Simulation</div>
              <canvas id="cvdDemoT" class="cvd-demo-canvas"></canvas>
            </div>
          </div>
        `,
      },
      {
        id: 'methods',
        icon: '🧭',
        title: 'Two Methods: Uniformity and Consistency',
        body: `
          <p>"Method" at the top left of the Generator tab switches between two methods. Neither is the better one — they <strong>aim at different things</strong>, so choose by what you need. The active method is always visible: in the "Method" switch, in the color of the panel's top edge (indigo for Uniformity, pink for Consistency), in the score heading and on the Optimize button.</p>
          <table class="param-table">
            <thead><tr><th></th><th>Uniformity</th><th>Consistency</th></tr></thead>
            <tbody>
              <tr><td>Goal</td><td>Even steps: every neighboring pair of colors differs by the same amount</td><td>Keep the original colormap's pattern of larger and smaller steps, and make that pattern hold up under CVD too</td></tr>
              <tr><td>Use it when</td><td>The steps carry no special meaning and you simply want an even scale</td><td>The steps are deliberate — a big jump to separate sea from land, say — and you want a CVD-friendly version of the same colormap</td></tr>
              <tr><td>Starts from</td><td>A preset, your upload, or Custom</td><td>An existing colormap (research map, preset or upload); no Custom</td></tr>
              <tr><td>Where the 15 colors sit</td><td>Evenly spaced along the colormap</td><td>Spaced so that neighbors differ by equal amounts (so not evenly spaced)</td></tr>
              <tr><td>What is scored</td><td>U (uniformity), Q (contrast), S (smoothness)</td><td>F (consistency), Q, S</td></tr>
              <tr><td>Default weights</td><td>w<sub>u</sub> = 0.1, w<sub>q</sub> = 0.7</td><td>w<sub>f</sub> = 0.1, w<sub>q</sub> = 0.8</td></tr>
              <tr><td>CVD types</td><td>Optional</td><td>At least one required</td></tr>
            </tbody>
          </table>
          <h3>The objective function: how "good" is measured</h3>
          <p>The optimization moves the colors to make a single number, E, as small as possible. E is a weighted sum of three terms. The two methods differ only in the first term; Q and S are the same in both.</p>
          <div class="formula-card">
            <div class="math-display">Uniformity: E = w<sub>u</sub>U + w<sub>q</sub>Q + w<sub>s</sub>S</div>
            <div class="math-display">Consistency: E = w<sub>f</sub>F + w<sub>q</sub>Q + w<sub>s</sub>S</div>
            <div class="math-note">(w<sub>s</sub> = 1 − w<sub>u</sub> − w<sub>q</sub>; in Consistency, 1 − w<sub>f</sub> − w<sub>q</sub>)</div>
          </div>
          <ul>
            <li><strong>U (uniformity)</strong>: are the steps between neighboring colors all the same size to the eye?
              <ul>
                <li>Measured as the coefficient of variation (standard deviation ÷ mean) of the color difference ΔE between neighboring colors.</li>
              </ul>
            </li>
            <li><strong>F (consistency)</strong>: does the original colormap's pattern of steps survive under CVD?
              <div class="formula-card">
                <div class="math-note">F = (1 − 0.05) · (Σ<sub>c</sub> σ<sub>c</sub>) / |C| + 0.05 · F̂</div>
              </div>
              <ul>
                <li><strong>σ<sub>c</sub></strong>: for each CVD type c, take every pair of neighboring colors and divide the difference seen with CVD by the difference seen normally. σ<sub>c</sub> is how much that ratio varies along the colormap (its standard deviation). If it is 0, the ratio is the same everywhere: someone with CVD sees the same pattern of steps, just scaled.</li>
                <li><strong>F̂</strong>: how far, on average, the steps between neighbors have moved from those of the original colormap (in ΔE<sub>00</sub>). Smaller means closer to the original pattern.</li>
                <li><strong>|C|</strong>: the number of CVD types selected. F is defined per CVD type, which is why at least one is required.</li>
              </ul>
            </li>
            <li><strong>Q (contrast)</strong>: can every pair of colors still be told apart under CVD?
              <ul>
                <li>Each pair is penalized when its color difference under CVD drops below a target: half of the difference seen normally, capped at 30.</li>
              </ul>
            </li>
            <li><strong>S (smoothness)</strong>: does the colormap trace a smooth path through L*a*b* space, without sharp turns?</li>
          </ul>
          <div class="insight-box">
            In Consistency, 15 colors are picked from the 256-color colormap you chose, spaced so that neighbors differ by equal amounts. The finished colormap is scored on its 256 colors — every 8th one plus the last — and F compares the steps there with the original colormap's steps at the same places.
          </div>
        `,
      },
      {
        id: 'optimization',
        icon: '⚡',
        title: 'How Optimization Works',
        body: `
          <p>Colormap Studio searches for good colors with <strong>simulated annealing (SA)</strong>, a trial-and-error method that starts out adventurous and gradually settles down.</p>
          <p>What counts as "good" — the objective function E — is described in "Two Methods" above. This section is about how the search for a small E works.</p>
          <h3>Key Parameters</h3>
          <table class="param-table">
            <thead><tr><th>Parameter</th><th>Description</th><th>Default</th></tr></thead>
            <tbody>
              <tr><td>u_WEIGHT / f_WEIGHT</td><td>How much uniformity U (or consistency F) counts (w<sub>u</sub>, w<sub>f</sub>)</td><td>0.1</td></tr>
              <tr><td>q_WEIGHT</td><td>How much contrast Q counts (w<sub>q</sub>). Whatever is left (1 minus the two weights) goes to smoothness S</td><td>0.7 (Uniformity) / 0.8 (Consistency)</td></tr>
              <tr><td>S1_WEIGHT</td><td>A coefficient used inside the smoothness term S</td><td>1.0</td></tr>
              <tr><td>R</td><td>Roughly how far a ★ color may drift from the color you chose (as a color difference ΔE). Smaller keeps it closer</td><td>7.0</td></tr>
              <tr><td>R′</td><td>The same for colors without ★. Larger lets them move more</td><td>10.0</td></tr>
              <tr><td>T_init / T_end</td><td>Start and end "temperature" of the search. While it is hot, the search also accepts changes for the worse and explores widely</td><td>1.0 / 0.0001</td></tr>
              <tr><td>Alpha</td><td>Cooling rate: the temperature is multiplied by this at each stage</td><td>0.925</td></tr>
              <tr><td>Iterations</td><td>Trial moves per temperature. More is slower but more thorough</td><td>5500</td></tr>
              <tr><td>Seed</td><td>Random seed. The same seed with the same settings reproduces the same result</td><td>empty (different each time)</td></tr>
            </tbody>
          </table>
          <h3>SA Process</h3>
          <div class="sa-steps">
            <div class="sa-step">
              <div class="sa-step-num">1</div>
              <div class="sa-step-text">Start from the colors on screen</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">2</div>
              <div class="sa-step-text">Pick one color at random and nudge it slightly in L*a*b* space</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">3</div>
              <div class="sa-step-text">Keep the change if E gets smaller. If it gets larger, keep it only sometimes — more often while the temperature is high</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">4</div>
              <div class="sa-step-text">Lower the temperature a little and repeat steps 2–3</div>
            </div>
          </div>
        `,
      },
      {
        id: 'how-to-use',
        icon: '📖',
        title: 'How to Use',
        body: `
          <p>Colormap Studio builds colormaps that still work for people with color vision deficiency (CVD). Everything happens on the Generator tab.</p>
          <div class="quick-start">
            <div class="quick-start-title">The short version</div>
            <ol>
              <li>Pick a starting colormap under <strong>Preset colormap</strong></li>
              <li>Press <strong>Optimize</strong> and wait a few seconds</li>
              <li>Save it with <strong>Export</strong></li>
            </ol>
            <p>That's all you need for a usable colormap. Read on only for the parts you care about — choosing your own colors, say, or improving a colormap you already have.</p>
          </div>
          <div class="tutorial-figure">
            <div class="ui-map" role="img" aria-label="Map of the Generator screen">
              <div class="ui-map-nav"><span class="ui-map-tab on">Generator</span><span class="ui-map-tab">Test<b class="ui-badge">5</b></span><span class="ui-map-tab">Tutorial</span></div>
              <div class="ui-map-body">
                <div class="ui-map-left">
                  <div class="ui-map-box"><span class="ui-map-cap">Method</span><span class="ui-map-seg"><i class="on">Uniformity</i><i>Consistency</i></span><b class="ui-badge">1</b></div>
                  <div class="ui-map-box"><span class="ui-map-cap">Preset colormap</span><span class="ui-map-select">Viridis ▾</span><b class="ui-badge">1</b></div>
                  <div class="ui-map-box"><span class="ui-map-cap">CVD types</span><span class="ui-map-chips"><i>P-type</i><i>D-type</i><i class="off">T-type</i></span><b class="ui-badge">3</b></div>
                  <div class="ui-map-box ui-map-optimize"><span class="ui-map-btn">Optimize</span><b class="ui-badge">4</b></div>
                </div>
                <div class="ui-map-right">
                  <div class="ui-map-box"><span class="ui-map-cap">Colors of the colormap</span><span class="ui-map-strip"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span><b class="ui-badge">2</b></div>
                  <div class="ui-map-box"><span class="ui-map-cap">Colormap preview / CVD simulation</span><span class="ui-map-bar"></span><span class="ui-map-bar ui-map-bar2"></span></div>
                  <div class="ui-map-box"><span class="ui-map-cap">Export</span><span class="ui-map-exports"><i>⬇ JSON</i><i>⬇ CSV</i><i>⬇ PNG</i><i>⬇ Python</i></span><b class="ui-badge">6</b></div>
                </div>
              </div>
            </div>
            <p class="tutorial-caption">↑ The Generator screen. The numbered circles show where each of steps 1–6 happens.</p>
          </div>
          <div class="guide-steps">
            <div class="guide-step">
              <div class="guide-step-icon">1</div>
              <div class="guide-step-content">
                <h4>Choose a method and a starting colormap</h4>
                <ul>
                  <li><strong>Method</strong>: <strong>Uniformity</strong> is the right choice most of the time. It gives a colormap whose colors change at an even pace from end to end.</li>
                  <li>Choose <strong>Consistency</strong> when the way your original colormap changes is meaningful — a deliberate jump between sea and land, for instance — and you want to keep it.</li>
                  <li><strong>Preset colormap</strong>: pick the colormap to start from.</li>
                  <li><strong>Use your own</strong>: choose "Upload colormap (image / CSV)…" from the list and load a horizontal colormap image (PNG, JPEG, BMP or PPM) or a CSV of RGB or L*a*b* values. The file never leaves your browser.</li>
                  <li><strong>Start from scratch</strong>: choose "Custom" to begin with only the two end colors in place (Uniformity only).</li>
                </ul>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">2</div>
              <div class="guide-step-content">
                <h4>Set the colors (skip this if you're happy with them)</h4>
                <ul>
                  <li>The 15 squares in the middle are the colors your colormap passes through.</li>
                  <li>Click a square to open the color picker, choose a color, and press <strong>Apply</strong>.</li>
                  <li><strong>★ marks a color you want to keep.</strong> It appears automatically when you set a color, and the optimization holds that color close to what you chose.</li>
                  <li><strong>Right-click</strong> a square to remove its ★. A color without ★ is only a starting point and may move further. If there are just a few colors you care about, remove the ★ from the rest.</li>
                  <li>The <strong>✕</strong> in a square's corner removes its color. Empty squares are filled in from their neighbors (not available in Consistency).</li>
                  <li>The two ends (squares 0 and 14) must always have a color.</li>
                </ul>
                <div class="ui-map ui-map-inline" role="img" aria-label="Example of the color squares">
                  <span class="ui-map-strip ui-map-strip-demo"><i class="star"></i><i class="star"></i><i class="none"></i><i class="none"></i><i class="star"></i><i class="none"></i><i></i><i class="none"></i><i class="star"></i><i class="star"></i></span>
                  <span class="ui-map-note">★ = kept close · no ★ = free to move · dashed = empty (filled in automatically)</span>
                </div>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">3</div>
              <div class="guide-step-content">
                <h4>Choose which kinds of color vision to design for</h4>
                <ul>
                  <li>Tick the types you want under <strong>CVD types</strong>. If unsure, tick both P-type and D-type.</li>
                  <li>A preview of how each ticked type sees the colormap appears right away.</li>
                  <li>Consistency needs at least one type ticked.</li>
                </ul>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">4</div>
              <div class="guide-step-content">
                <h4>Press Optimize</h4>
                <ul>
                  <li>Press <strong>Optimize</strong>. It takes from a few seconds to under a minute.</li>
                  <li>When it finishes, the colormap <strong>before optimization</strong> appears under each preview so you can compare.</li>
                  <li>Scores are shown as "before → after." <strong>Lower is better for every number.</strong> Rest the pointer on a number to see what it measures.</li>
                  <li>Each run gives a slightly different result. If you don't like it, press Optimize again, or adjust a color first.</li>
                  <li>To get exactly the same result again, type the seed shown under the score into "Seed" (under "Advanced parameters") and run with the same settings.</li>
                </ul>
                <div class="ui-map ui-map-inline" role="img" aria-label="Example of the display after optimization">
                  <span class="ui-map-cap">Colormap preview</span><span class="ui-map-bar"></span>
                  <span class="ui-map-note">Before optimization</span><span class="ui-map-bar ui-map-bar-before"></span>
                  <span class="ui-map-score">E · Uniformity: <span class="dim">0.07804 →</span> 0.04433</span>
                  <span class="ui-map-note">Top: after. Bottom: before. Score: before → after.</span>
                </div>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">5</div>
              <div class="guide-step-content">
                <h4>Check it on real pictures in the Test tab</h4>
                <ul>
                  <li>Open the <strong>Test</strong> tab to see your colormap applied to a set of sample data and images.</li>
                  <li>Click one to enlarge it. Normal vision and each type of CVD are shown side by side.</li>
                  <li>"Current (from Generator)" under "Colormap" is the one you are making. Switch to Jet, Viridis and others to compare.</li>
                  <li>Move the pointer over a picture to read the value and color at that spot.</li>
                  <li><strong>What to look for</strong>: bands or edges that aren't in the data, and areas that were distinct but blur together in the CVD pictures.</li>
                </ul>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">6</div>
              <div class="guide-step-content">
                <h4>Save it</h4>
                <ul>
                  <li><strong>PNG</strong>: a color-bar image, for documents and slides.</li>
                  <li><strong>CSV</strong>: the 256 colors as numbers; opens in Excel.</li>
                  <li><strong>JSON</strong>: data for other programs to read.</li>
                  <li><strong>Python (matplotlib)</strong>: a ready-to-use file (colormap.py). Put it next to your script, write <code>from colormap import cmap</code>, and use it as in <code>plt.imshow(data, cmap=cmap)</code>.</li>
                  <li>The JSON and Python files also record how the colormap was made (method, starting colormap, CVD types, settings, seed, scores) — handy when you need to report it in a paper.</li>
                  <li>Colormaps you make here are free to use. No credit is required.</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="insight-box">
            <strong>If something isn't working</strong>
            <ul>
              <li>Optimize won't start: check that squares 0 and 14 both have a color. Consistency also needs at least one CVD type and a color in all 15 squares.</li>
              <li>You want to start over: pick the preset again and everything is reset.</li>
              <li>The colors barely change: ★ colors are held close to where they are. Right-click to remove the ★ from colors that are allowed to move.</li>
            </ul>
          </div>
        `,
      },
    ],
  },
};

// ===== Render tutorial =====
function renderTutorial() {
  const content = CONTENT[currentLang];
  const container = $('#tutorialContent');
  if (!container) return;

  // The how-to guide comes first; the background chapters follow under their own heading
  const guide = content.sections.filter(s => s.id === 'how-to-use');
  const background = content.sections.filter(s => s.id !== 'how-to-use');
  const t = currentLang === 'ja'
    ? { toc: '目次', background: 'くわしく知りたい方へ', backgroundNote: 'ここから先は、カラーマップの基礎と、このサイトの手法の説明です。使うだけなら読まなくても構いません。' }
    : { toc: 'Contents', background: 'Background', backgroundNote: "The chapters below cover the basics of colormaps and the methods behind this site. You don't need them to use it." };
  const section = s => `
    <section class="tutorial-section" id="tutorial-${s.id}">
      <div class="tutorial-section-header">
        <span class="tutorial-section-icon">${s.icon}</span>
        <h2>${s.title}</h2>
      </div>
      <div class="tutorial-section-body">${s.body}</div>
    </section>
  `;
  const tocItem = s => `<button type="button" class="tutorial-toc-item" data-target="tutorial-${s.id}">${s.icon} ${s.title}</button>`;
  container.innerHTML = `
    <nav class="tutorial-toc" aria-label="${t.toc}">
      <span class="tutorial-toc-title">${t.toc}</span>
      ${guide.map(tocItem).join('')}
      <span class="tutorial-toc-sep">${t.background}</span>
      ${background.map(tocItem).join('')}
    </nav>
    ${guide.map(section).join('')}
    <div class="tutorial-divider"><h2>${t.background}</h2><p>${t.backgroundNote}</p></div>
    ${background.map(section).join('')}
  `;
  container.querySelectorAll('.tutorial-toc-item').forEach(b => b.addEventListener('click', () => {
    document.getElementById(b.dataset.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  // Render interactive demos after DOM update
  requestAnimationFrame(() => {
    renderCompareDemo();
    renderColormapDemo();
    renderGamutDemo();
    renderCvdDemo();
  });
}

// ===== Interactive Demos =====
import { interpolateColors } from './optimizer.js';

// Jet and Viridis Lab control points
const JET_LAB = [
  [13.0, 26.0, -50.0], [32.0, 10.0, -60.0], [53.0, -35.0, -42.0],
  [72.0, -45.0, 5.0],  [90.0, -30.0, 68.0], [85.0, 15.0, 80.0],
  [68.0, 60.0, 60.0],  [50.0, 70.0, 50.0],  [32.0, 60.0, 25.0],
];
const VIRIDIS_LAB = [
  [13.0, 26.0, -45.0], [18.0, 10.0, -38.0], [29.0, -12.0, -28.0],
  [40.0, -25.0, -10.0],[52.0, -32.0, 5.0],  [64.0, -30.0, 25.0],
  [76.0, -20.0, 45.0], [88.0, -5.0, 68.0],  [97.0, -8.0, 85.0],
];

function buildTutorialLUT(labPoints) {
  const n = labPoints.length;
  const ls = labPoints.map(c => c[0]);
  const as = labPoints.map(c => c[1]);
  const bs = labPoints.map(c => c[2]);
  const interp = interpolateColors(256, n, ls, as, bs);
  const lut = new Array(256);
  for (let i = 0; i < 256; i++) {
    const rgb = cielab2nlrgb(interp.ls[i], interp.as[i], interp.bs[i]);
    lut[i] = [Math.max(0, Math.min(255, Math.round(rgb[0]))),
              Math.max(0, Math.min(255, Math.round(rgb[1]))),
              Math.max(0, Math.min(255, Math.round(rgb[2])))];
  }
  return lut;
}

function renderCompareDemo() {
  const jetCanvas = document.getElementById('compareJetCanvas');
  const viridisCanvas = document.getElementById('compareViridisCanvas');
  if (!jetCanvas || !viridisCanvas) return;

  const jetLUT = buildTutorialLUT(JET_LAB);
  const viridisLUT = buildTutorialLUT(VIRIDIS_LAB);

  // Generate 2D Gaussian test data
  const W = 300, H = 140;
  const data = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W - 0.5) * 3;
      const ny = (y / H - 0.5) * 3;
      data[y * W + x] = Math.exp(-(nx * nx + ny * ny) * 0.8)
        + 0.3 * Math.exp(-((nx + 1) ** 2 + (ny - 0.5) ** 2) * 2)
        + 0.2 * Math.exp(-((nx - 0.8) ** 2 + (ny + 0.4) ** 2) * 3);
    }
  }

  function renderToCanvas(canvas, lut) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const imgData = ctx.createImageData(W, H);
    let max = -Infinity, min = Infinity;
    for (const v of data) { if (v > max) max = v; if (v < min) min = v; }
    for (let i = 0; i < W * H; i++) {
      const idx = Math.min(255, Math.max(0, Math.round((data[i] - min) / (max - min) * 255)));
      imgData.data[i * 4]     = lut[idx][0];
      imgData.data[i * 4 + 1] = lut[idx][1];
      imgData.data[i * 4 + 2] = lut[idx][2];
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  renderToCanvas(jetCanvas, jetLUT);
  renderToCanvas(viridisCanvas, viridisLUT);
}

// Turbo colormap demo
function renderColormapDemo() {
  const TURBO = [
    [11.95, 23.19, -20.0], [33.83, 29.84, -54.15], [50.59, 25.09, -65.23],
    [63.16, 5.61, -56.89], [73.32, -29.09, -25.61], [81.49, -55.85, 9.84],
    [86.93, -68.52, 42.99], [90.39, -62.68, 70.50], [90.09, -44.12, 79.02],
    [85.95, -16.31, 75.49], [79.49, 11.79, 70.01], [69.51, 36.24, 67.24],
    [58.02, 54.79, 64.09], [48.04, 60.66, 58.66], [37.44, 56.82, 50.63],
    [24.49, 45.74, 35.51],
  ];
  const canvas = document.getElementById('tutorialColormapDemo');
  if (!canvas) return;
  const n = TURBO.length;
  const ls = TURBO.map(c => c[0]);
  const as = TURBO.map(c => c[1]);
  const bs = TURBO.map(c => c[2]);
  const interp = interpolateColors(256, n, ls, as, bs);

  const w = canvas.clientWidth || 600;
  const h = canvas.clientHeight || 60;
  canvas.width = w * window.devicePixelRatio;
  canvas.height = h * window.devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  for (let x = 0; x < w; x++) {
    const i = Math.min(Math.floor(x / w * 256), 255);
    const rgb = cielab2nlrgb(interp.ls[i], interp.as[i], interp.bs[i]);
    ctx.fillStyle = `rgb(${Math.round(rgb[0])},${Math.round(rgb[1])},${Math.round(rgb[2])})`;
    ctx.fillRect(x, 0, 1, h);
  }
}

// Gamut demo at L*=50
function renderGamutDemo() {
  const canvas = document.getElementById('tutorialGamutDemo');
  if (!canvas) return;
  const size = 280;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const RANGE = 128;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const a = -RANGE + (2 * RANGE * px) / (size - 1);
      const b = RANGE - (2 * RANGE * py) / (size - 1);
      const idx = (py * size + px) * 4;
      if (judgeInout(50, a, b) === 0) {
        const rgb = cielab2nlrgb(50, a, b);
        data[idx] = Math.round(rgb[0]);
        data[idx + 1] = Math.round(rgb[1]);
        data[idx + 2] = Math.round(rgb[2]);
        data[idx + 3] = 255;
      } else {
        data[idx] = 20; data[idx + 1] = 20; data[idx + 2] = 30; data[idx + 3] = 255;
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Axis
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText('+a*', size - 22, size / 2 - 4);
  ctx.fillText('−a*', 3, size / 2 - 4);
  ctx.fillText('+b*', size / 2 + 4, 12);
  ctx.fillText('−b*', size / 2 + 4, size - 4);
}

// Generate a colorful test image (color wheel + gradient patches) for CVD demo
function generateCvdTestImage(w, h) {
  const pixels = new Uint8ClampedArray(w * h * 4);
  const cx = w / 2, cy = h / 2;
  const r = Math.min(w, h) * 0.42;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = (y * w + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= r) {
        // Color wheel: hue from angle, saturation from radius
        const angle = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
        const sat = dist / r;
        // HSV to RGB
        const h6 = angle * 6;
        const hi = Math.floor(h6) % 6;
        const f = h6 - Math.floor(h6);
        const v = 220;
        const p2 = Math.round(v * (1 - sat));
        const q = Math.round(v * (1 - sat * f));
        const t2 = Math.round(v * (1 - sat * (1 - f)));
        const vr = Math.round(v);
        const colors = [[vr,t2,p2],[q,vr,p2],[p2,vr,t2],[p2,q,vr],[t2,p2,vr],[vr,p2,q]];
        const [rr, gg, bb] = colors[hi];
        pixels[p] = rr; pixels[p+1] = gg; pixels[p+2] = bb; pixels[p+3] = 255;
      } else {
        // Background: grayscale gradient
        const gray = Math.round((x / w) * 200 + 30);
        pixels[p] = gray; pixels[p+1] = gray; pixels[p+2] = gray; pixels[p+3] = 255;
      }
    }
  }
  return pixels;
}

function applyCVDToPixels(srcPixels, w, h, simFn) {
  const out = new Uint8ClampedArray(srcPixels);
  for (let i = 0; i < w * h; i++) {
    const ri = out[i * 4] / 255;
    const gi = out[i * 4 + 1] / 255;
    const bi = out[i * 4 + 2] / 255;

    const rl = ri <= 0.04045 ? ri / 12.92 : Math.pow((ri + 0.055) / 1.055, 2.4);
    const gl = gi <= 0.04045 ? gi / 12.92 : Math.pow((gi + 0.055) / 1.055, 2.4);
    const bl = bi <= 0.04045 ? bi / 12.92 : Math.pow((bi + 0.055) / 1.055, 2.4);

    let X = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
    let Y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
    let Z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;

    const Xn = 0.950456, Yn = 1.0, Zn = 1.088754;
    const fx = X / Xn > 0.008856 ? Math.cbrt(X / Xn) : 7.787 * (X / Xn) + 16 / 116;
    const fy = Y / Yn > 0.008856 ? Math.cbrt(Y / Yn) : 7.787 * (Y / Yn) + 16 / 116;
    const fz = Z / Zn > 0.008856 ? Math.cbrt(Z / Zn) : 7.787 * (Z / Zn) + 16 / 116;
    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bv = 200 * (fy - fz);

    const lab = [L, a, bv];
    simFn(lab);

    const rgb = cielab2nlrgb(lab[0], lab[1], lab[2]);
    out[i * 4]     = Math.max(0, Math.min(255, Math.round(rgb[0])));
    out[i * 4 + 1] = Math.max(0, Math.min(255, Math.round(rgb[1])));
    out[i * 4 + 2] = Math.max(0, Math.min(255, Math.round(rgb[2])));
  }
  return out;
}

function renderCvdDemo() {
  const canvasNormal = document.getElementById('cvdDemoNormal');
  if (!canvasNormal) return;

  const W = 220, H = 180;
  const srcPixels = generateCvdTestImage(W, H);

  function paintCanvas(canvas, pixels) {
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(W, H);
    imgData.data.set(pixels);
    ctx.putImageData(imgData, 0, 0);
  }

  paintCanvas(canvasNormal, srcPixels);

  const simTypes = [
    { id: 'cvdDemoP', fn: simPBrettel },
    { id: 'cvdDemoD', fn: simDBrettel },
    { id: 'cvdDemoT', fn: simTBrettel },
  ];

  for (const { id, fn } of simTypes) {
    const canvas = document.getElementById(id);
    if (!canvas) continue;
    paintCanvas(canvas, applyCVDToPixels(srcPixels, W, H, fn));
  }
}

// ===== Init =====
export function initTutorialPage() {
  // Language toggle
  const langBtns = document.querySelectorAll('.lang-btn');
  langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentLang = btn.dataset.lang;
      langBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderTutorial();
    });
  });
}

export function renderTutorialPage() {
  renderTutorial();
}
