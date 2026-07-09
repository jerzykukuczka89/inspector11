import sys

css_file = 'css/style.css'
with open(css_file, 'r', encoding='utf-8') as f:
    css = f.read()

# Fix 1: Login button moving during typing
css = css.replace('.lg-inputs{display:flex;flex-direction:column;gap:10px;flex:1;min-width:0}', '.lg-inputs{display:flex;flex-direction:column;gap:10px;width:calc(100% - 160px);flex-shrink:0}')

# Fix 2: Hide tilde (~) in mobile header
hide_tilde = '''  body.is-mobile .d-user span:nth-child(2) { display: none !important; }'''
if 'body.is-mobile .d-user span:nth-child(2)' not in css:
    css = css.replace('body.is-mobile .d-header {', hide_tilde + '\n  body.is-mobile .d-header {')

# Fix 3: Ensure header and slide stack without overlapping
stack_fix = '''  body.is-mobile #mheader { order: -1 !important; position: static !important; }
  body.is-mobile .slide.active { position: static !important; }
  body.is-mobile .dash { position: static !important; margin-top: 0 !important; }'''
if 'body.is-mobile #mheader' not in css:
    css = css.replace('body.is-mobile .slide.active { display: block; position: static; }', 'body.is-mobile .slide.active { display: block; position: static; }\n' + stack_fix)

with open(css_file, 'w', encoding='utf-8') as f:
    f.write(css)

print('Applied all three fixes to CSS')
