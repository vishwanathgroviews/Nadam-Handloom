"""Builds dist/artifact.html: the mock-up as one page fragment for publishing on claude.ai.

The hosted artifact wraps the file in its own <html>/<head>/<body>, so the fragment starts
with <title> and <style>, then the shell markup, then every script inlined in order. Image
paths stay relative (img/...), and the images are published alongside as files.

Run:  python3 build/assemble.py
"""
import os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DIST = os.path.join(ROOT, 'dist')
os.makedirs(DIST, exist_ok=True)

html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
css = open(os.path.join(ROOT, 'assets', 'mock.css'), encoding='utf-8').read()
title = re.search(r'<title>(.*?)</title>', html).group(1)
fonts = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">', html).group(1)
shell = html[html.index('<!--SHELL-START-->') + len('<!--SHELL-START-->'):html.index('<!--SHELL-END-->')]
scripts = re.findall(r'<script src="assets/([^"]+)"></script>', html)
js = '\n'.join(open(os.path.join(ROOT, 'assets', s), encoding='utf-8').read() for s in scripts)
assert '</script>' not in js, 'a script contains </script>'

page = (f'<title>{title}</title>\n'
        f'<link rel="stylesheet" href="{fonts}">\n'
        f'<style>\n{css}\n</style>\n'
        f'{shell.strip()}\n'
        f'<script>\n{js}\n</script>\n')
out = os.path.join(DIST, 'artifact.html')
open(out, 'w', encoding='utf-8').write(page)
print('written', out, round(len(page.encode()) / 1024), 'KB, scripts:', ', '.join(scripts))
