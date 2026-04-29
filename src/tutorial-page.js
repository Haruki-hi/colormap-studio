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
          <p>カラーマップの選択は、データの解釈を大きく左右します。<strong>誤ったカラーマップは存在しないパターンを生み出し、重要な特徴を隠蔽します。</strong></p>
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
            <strong>NASA・Nature・Science</strong> 等の主要機関・誌が Jet の使用を非推奨とし、知覚均一なカラーマップへの移行を推奨しています。
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
        id: 'optimization',
        icon: '⚡',
        title: '最適化エンジン',
        body: `
          <p>Colormap Studio は <strong>焼きなまし法（Simulated Annealing, SA）</strong> を使って、CVD に配慮したカラーマップを自動生成します。</p>
          <h3>目的関数 (e_score)</h3>
          <p>最適化の目的関数は以下の要素を組み合わせています：</p>
          <div class="formula-card">
            <code>e_score = u_WEIGHT × UC + q_WEIGHT × UQ + (1 - u_WEIGHT - q_WEIGHT) × es</code>
          </div>
          <ul>
            <li><strong>UC (均等性スコア)</strong>: 各 CVD タイプ下での隣接する色の知覚差の「一貫性」を評価
              <ul>
                <li>隣接スロット間の ΔE の変動係数（標準偏差/平均）を最小化します。</li>
              </ul>
            </li>
            <li><strong>UQ (品質・アクセシビリティスコア)</strong>: 全ペアの色の組み合わせにおける色の識別性を評価
              <ul>
                <li>全ての色の組み合わせについて、CVD 下での色差が目標値（通常色覚の色差の半分、最大30）を下回らないよう重み付け評価します。</li>
              </ul>
            </li>
            <li><strong>es (滑らかさ)</strong>: カラーマップパスの滑らかさ（方向変化の小ささ）を評価</li>
          </ul>
          <h3>主要パラメータ</h3>
          <table class="param-table">
            <thead><tr><th>パラメータ</th><th>説明</th><th>デフォルト</th></tr></thead>
            <tbody>
              <tr><td>u_WEIGHT</td><td>均等性（UC）の重み</td><td>0.1</td></tr>
              <tr><td>q_WEIGHT</td><td>品質（UQ）の重み</td><td>0.7</td></tr>
              <tr><td>S1_WEIGHT</td><td>滑らかさ（es）の計算時の係数</td><td>1.0</td></tr>
              <tr><td>R</td><td>プリファレンス色の移動バイアス半径</td><td>7.0</td></tr>
              <tr><td>R'</td><td>非プリファレンス色の移動バイアス半径</td><td>10.0</td></tr>
            </tbody>
          </table>
          <h3>SAのプロセス</h3>
          <div class="sa-steps">
            <div class="sa-step">
              <div class="sa-step-num">1</div>
              <div class="sa-step-text">初期カラーマップ（プリセットまたはカスタム）からスタート</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">2</div>
              <div class="sa-step-text">ランダムに1色を選び、L*a*b*空間内で微小摂動を加える</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">3</div>
              <div class="sa-step-text">e_score が改善されたら採用。悪化しても確率的に採用（温度に依存）</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">4</div>
              <div class="sa-step-text">温度を徐々に下げながらステップ 2–3 を繰り返す</div>
            </div>
          </div>
        `,
      },
      {
        id: 'analytic-mode',
        icon: '📊',
        title: '分析モード（Analytic Mode）',
        body: `
          <p>Test ページの <strong>Analytic Mode</strong> では、カラーマップが CVD に対してどれだけ「一貫性」を持っているかを3つのマップで視覚化できます。</p>
          <div class="analytic-mode-cards">
            <div class="analytic-card">
              <div class="analytic-card-title">Normal Vision ΔE</div>
              <p>通常色覚での隣接ピクセル間の <strong>CIEDE2000 色差</strong>。明るいほど色が大きく変化している領域です。理想的なカラーマップでは、データの変化に比例してこの値が均一になります。</p>
            </div>
            <div class="analytic-card">
              <div class="analytic-card-title">CVD Simulation ΔE</div>
              <p>CVD シミュレーション下での同じ隣接ピクセル間の色差。CVD 対応カラーマップでは、上段（Normal Vision）と近い分布になるはずです。</p>
            </div>
            <div class="analytic-card analytic-diff-card">
              <div class="analytic-card-title">CVD Discrepancy（差分マップ）</div>
              <p>上記2つの差分（Normal ΔE − CVD ΔE）を色で表します：</p>
              <ul>
                <li><span class="diff-chip diff-white">白</span> 通常色覚と CVD でコントラストが一致（<strong>理想</strong>）</li>
                <li><span class="diff-chip diff-red">赤</span> CVD 下でコントラストが失われる（情報の欠落・最も問題）</li>
                <li><span class="diff-chip diff-blue">青</span> CVD 下でコントラストが過剰になる（過強調）</li>
              </ul>
            </div>
          </div>
          <div class="insight-box">
            差分マップが全体的に白い＝CVD 対応度が高いカラーマップです。Colormap Studio の最適化は、この差分が最小になるよう設計されています。
          </div>
        `,
      },
      {
        id: 'how-to-use',
        icon: '📖',
        title: '使い方ガイド',
        body: `
          <div class="guide-steps">
            <div class="guide-step">
              <div class="guide-step-icon">1</div>
              <div class="guide-step-content">
                <h4>プリセットを選択する</h4>
                <p>Generator ページの左パネルから、ベースとなるカラーマップを選択します。または「Custom」を選んで独自のカラーマップを作成できます。</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">2</div>
              <div class="guide-step-content">
                <h4>制御点を編集する</h4>
                <p>16 スロットのカラーストリップで色を編集できます。スロットをクリックすると a*-b* 色域ピッカーが開きます。右クリックでプリファレンス（★）のオン/オフを切り替えます。</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">3</div>
              <div class="guide-step-content">
                <h4>CVD タイプを設定する</h4>
                <p>考慮したい CVD タイプ（P型/D型/T型）のチェックボックスをオンにします。プレビューバーでシミュレーション結果を確認できます。</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">4</div>
              <div class="guide-step-content">
                <h4>最適化を実行する</h4>
                <p>「Optimize」ボタンをクリックすると SA が開始されます。プログレスバーで進捗を確認できます。</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">5</div>
              <div class="guide-step-content">
                <h4>テストする</h4>
                <p>Test ページに移動し、生成したカラーマップを実データに適用して可視化します。CVD シミュレーションで見え方を確認しましょう。</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">6</div>
              <div class="guide-step-content">
                <h4>エクスポートする</h4>
                <p>JSON、CSS、PNG、CSV 形式でカラーマップをエクスポートできます。</p>
              </div>
            </div>
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
          <p>The choice of colormap profoundly affects how data is interpreted. <strong>A poor colormap creates patterns that don't exist and hides features that do.</strong></p>
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
            <strong>NASA, Nature, and Science</strong> have discouraged the use of Jet and recommend transitioning to perceptually uniform colormaps.
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
          <p>About 8% of males have some form of Color Vision Deficiency (CVD). When designing colormaps, it is crucial to ensure that information is accessible to individuals with CVD.</p>
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
        id: 'optimization',
        icon: '⚡',
        title: 'Optimization Engine',
        body: `
          <p>Colormap Studio uses <strong>Simulated Annealing (SA)</strong> to automatically generate CVD-aware colormaps.</p>
          <h3>Objective Function (e_score)</h3>
          <p>The optimization objective combines several components:</p>
          <div class="formula-card">
            <code>e_score = u_WEIGHT × UC + q_WEIGHT × UQ + (1 - u_WEIGHT - q_WEIGHT) × es</code>
          </div>
          <ul>
            <li><strong>UC (Uniformity Score)</strong>: Evaluates "consistency" of perceived color differences under CVD.
              <ul>
                <li>Minimizes the coefficient of variation (std dev / mean) of ΔE between adjacent slots.</li>
              </ul>
            </li>
            <li><strong>UQ (Quality/Accessibility Score)</strong>: Evaluates discriminability across all color pairs.
              <ul>
                <li>Performs a weighted evaluation ensuring that CVD color differences do not fall below a target value (half of normal ΔE, up to 30) for all color combinations.</li>
              </ul>
            </li>
            <li><strong>es (Smoothness)</strong>: Evaluates the smoothness of the colormap path in Lab space.</li>
          </ul>
          <h3>Key Parameters</h3>
          <table class="param-table">
            <thead><tr><th>Parameter</th><th>Description</th><th>Default</th></tr></thead>
            <tbody>
              <tr><td>u_WEIGHT</td><td>Uniformity (UC) weight</td><td>0.1</td></tr>
              <tr><td>q_WEIGHT</td><td>Quality (UQ) weight</td><td>0.7</td></tr>
              <tr><td>S1_WEIGHT</td><td>Coefficient for smoothness (es)</td><td>1.0</td></tr>
              <tr><td>R</td><td>Movement bias radius for preference colors</td><td>7.0</td></tr>
              <tr><td>R'</td><td>Movement bias radius for non-preference colors</td><td>10.0</td></tr>
            </tbody>
          </table>
          <h3>SA Process</h3>
          <div class="sa-steps">
            <div class="sa-step">
              <div class="sa-step-num">1</div>
              <div class="sa-step-text">Start from an initial colormap (preset or custom)</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">2</div>
              <div class="sa-step-text">Randomly select one color and apply a small perturbation in L*a*b* space</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">3</div>
              <div class="sa-step-text">Accept if e_score improves; also accept probabilistically if worse (temperature-dependent)</div>
            </div>
            <div class="sa-step">
              <div class="sa-step-num">4</div>
              <div class="sa-step-text">Gradually decrease temperature and repeat steps 2–3</div>
            </div>
          </div>
        `,
      },
      {
        id: 'analytic-mode',
        icon: '📊',
        title: 'Analytic Mode',
        body: `
          <p>The <strong>Analytic Mode</strong> on the Test page visualizes how "consistent" your colormap is under CVD across three diagnostic maps.</p>
          <div class="analytic-mode-cards">
            <div class="analytic-card">
              <div class="analytic-card-title">Normal Vision ΔE</div>
              <p>The <strong>CIEDE2000 color difference</strong> between adjacent pixels under normal vision. Brighter areas indicate greater local color change. An ideal colormap shows this varying proportionally with data changes.</p>
            </div>
            <div class="analytic-card">
              <div class="analytic-card-title">CVD Simulation ΔE</div>
              <p>The same color differences under CVD simulation. For a CVD-friendly colormap, this should closely match the Normal Vision map above.</p>
            </div>
            <div class="analytic-card analytic-diff-card">
              <div class="analytic-card-title">CVD Discrepancy Map</div>
              <p>The difference (Normal ΔE − CVD ΔE) shown as color:</p>
              <ul>
                <li><span class="diff-chip diff-white">White</span> Contrast matches — <strong>ideal</strong></li>
                <li><span class="diff-chip diff-red">Red</span> Contrast is lost under CVD — loss of information</li>
                <li><span class="diff-chip diff-blue">Blue</span> Contrast is amplified under CVD — over-emphasis</li>
              </ul>
            </div>
          </div>
          <div class="insight-box">
            A predominantly white discrepancy map means your colormap maintains consistent contrast under CVD. The Colormap Studio optimizer is designed to minimize this discrepancy.
          </div>
        `,
      },
      {
        id: 'how-to-use',
        icon: '📖',
        title: 'How to Use',
        body: `
          <div class="guide-steps">
            <div class="guide-step">
              <div class="guide-step-icon">1</div>
              <div class="guide-step-content">
                <h4>Select a Preset</h4>
                <p>Choose a base colormap from the left panel on the Generator page, or select "Custom" to create your own.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">2</div>
              <div class="guide-step-content">
                <h4>Edit Control Points</h4>
                <p>Edit colors in the 16-slot color strip. Click a slot to open the a*-b* gamut picker. Right-click to toggle preference (★).</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">3</div>
              <div class="guide-step-content">
                <h4>Configure CVD Types</h4>
                <p>Enable the CVD types (P/D/T) you want to optimize for. Preview bars show simulation results.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">4</div>
              <div class="guide-step-content">
                <h4>Run Optimization</h4>
                <p>Click "Optimize" to start the SA process. Monitor progress via the progress bar.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">5</div>
              <div class="guide-step-content">
                <h4>Test Results</h4>
                <p>Go to the Test page to apply your colormap to real data and visualize the results. Check CVD simulations to verify accessibility.</p>
              </div>
            </div>
            <div class="guide-step">
              <div class="guide-step-icon">6</div>
              <div class="guide-step-content">
                <h4>Export</h4>
                <p>Export your colormap in JSON, CSS, PNG, or CSV format.</p>
              </div>
            </div>
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

  container.innerHTML = content.sections.map(s => `
    <section class="tutorial-section" id="tutorial-${s.id}">
      <div class="tutorial-section-header">
        <span class="tutorial-section-icon">${s.icon}</span>
        <h2>${s.title}</h2>
      </div>
      <div class="tutorial-section-body">${s.body}</div>
    </section>
  `).join('');

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
