const fs = require('fs');

// 1. Read dist/index.html
const htmlContent = fs.readFileSync('dist/index.html', 'utf8');

// 2. Extract CSS code
let cssCode = '';
const cssLinkMatch = htmlContent.match(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']\.\/(assets\/[^"']+\.css)["']/i);
if (cssLinkMatch && fs.existsSync(`dist/${cssLinkMatch[1]}`)) {
  cssCode = fs.readFileSync(`dist/${cssLinkMatch[1]}`, 'utf8');
} else {
  const cssMatch = htmlContent.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);
  cssCode = cssMatch ? cssMatch[1] : '';
}

// 3. Extract JS code (find compiled React app bundle)
let jsCode = '';
const scriptSrcMatch = htmlContent.match(/<script[^>]*src=["']\.\/(assets\/[^"']+\.js)["']/i);
if (scriptSrcMatch && fs.existsSync(`dist/${scriptSrcMatch[1]}`)) {
  jsCode = fs.readFileSync(`dist/${scriptSrcMatch[1]}`, 'utf8');
} else {
  const scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRe.exec(htmlContent)) !== null) {
    if (match[1].length > jsCode.length) {
      jsCode = match[1];
    }
  }
}

if (!jsCode) {
  throw new Error('Could not find JS code in dist/index.html');
}

// 4. Generate the GAS-safe HTML with bypass
const html = `<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Lifestyle Premium Dining</title>
    <style>
      ${cssCode}
    </style>
  </head>
  <body>
    <div id="error-log" style="display:none; padding:20px; font-family:sans-serif; background:#fee; border-bottom:1px solid #f99;"></div>
    <div id="root">
      <div style="padding:40px; text-align:center; font-family:sans-serif;">Booting App...</div>
    </div>
    
    <script id="gas-safe-code" type="text/plain">
${jsCode.replace(/<\/script>/g, '<\\/script>')}
    </script>
    
    <script>
      window.onerror = function(msg, url, line, col, err) {
        var el = document.getElementById('error-log');
        if (el) {
          el.innerHTML += '<p style="color:red">Error: ' + msg + ' at line ' + line + '</p>';
          el.style.display = 'block';
        }
      };
      
      // Inject the code safely at runtime to bypass GAS HtmlService server-side parser
      var rawCode = document.getElementById('gas-safe-code').textContent;
      var script = document.createElement('script');
      script.textContent = rawCode;
      document.body.appendChild(script);
    </script>
  </body>
</html>`;

fs.writeFileSync('../Index.html', html, 'utf8');
console.log('Build completed, Index.html generated with bypass!');
