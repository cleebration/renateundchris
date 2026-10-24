import sys,base64,subprocess
from playwright.sync_api import sync_playwright
slug,w,h,out=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]; FPS=30
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':w,'height':h})
    pg.goto(f'http://localhost:8790/teaser.html?reise={slug}&w={w}&h={h}'); dur=pg.evaluate('window.ready')['dur']
    ff=subprocess.Popen(['ffmpeg','-loglevel','error','-y','-f','image2pipe','-vcodec','mjpeg','-framerate',str(FPS),'-i','-','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-movflags','+faststart',out],stdin=subprocess.PIPE)
    n=int(dur*FPS)
    for k in range(n):
        d=pg.evaluate(f'window.frame({k/FPS},0.9)'); ff.stdin.write(base64.b64decode(d[d.index(',')+1:]))
    ff.stdin.close(); ff.wait(); b.close(); print(out,n)
