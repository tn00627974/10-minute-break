"""把大廳、所有遊戲和封面打包成一個可以直接點兩下開的 HTML 檔。

用法（在專案資料夾裡執行）：
    python tools/build_single.py
產出：下課十分鐘.html
"""
import base64
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "下課十分鐘.html"

FETCH_BLOCK = """  const url = 'games/' + g.id + '.html';
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const html = await res.text();
    if (my !== token) return;
    f.srcdoc = html;              // same-origin document: shares localStorage with the lobby
  } catch (e) {
    if (my !== token) return;
    f.src = url;                  // fallback, e.g. when opened straight from disk
  }
"""
THUMB_SRC = '<img src="thumbs/${g.id}.jpg"'
MAIN_SCRIPT = "\n<script>\n(() => {"


def js_literal(obj):
    text = json.dumps(obj, ensure_ascii=False)
    # 遊戲本身也是 HTML，裡面的 </script> 會提早關掉外層的 <script>，所以要跳脫
    return (text.replace("</", "<\\/").replace("<!--", "<\\!--")
                .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029"))


def main():
    lobby = (ROOT / "index.html").read_text(encoding="utf-8")
    for needle, what in ((FETCH_BLOCK, "載入遊戲的程式"), (THUMB_SRC, "封面圖片的路徑"), (MAIN_SCRIPT, "主程式的開頭")):
        if lobby.count(needle) != 1:
            sys.exit(f"index.html 裡找不到原本的{what}，可能被改過了，請對照這支程式裡的字串調整。")

    games = {p.stem: p.read_text(encoding="utf-8") for p in sorted((ROOT / "games").glob("*.html"))}
    thumbs = {p.stem: "data:image/jpeg;base64," + base64.b64encode(p.read_bytes()).decode()
              for p in sorted((ROOT / "thumbs").glob("*.jpg"))}

    out = lobby.replace(FETCH_BLOCK, "  f.srcdoc = GAME_SRC[g.id];     // every game ships inside this one file\n")
    out = out.replace(THUMB_SRC, '<img src="${THUMBS[g.id]}"')
    out = out.replace("async function mount(g)", "function mount(g)", 1)
    data = ("<script>\nconst GAME_SRC = " + js_literal(games) + ";\nconst THUMBS = "
            + js_literal(thumbs) + ";\n</script>\n")
    i = out.index(MAIN_SCRIPT)
    out = out[:i + 1] + data + out[i + 1:]
    lb = ROOT / "leaderboard.js"
    if lb.exists():
        # 排行榜模組也包進來，用 data: 網址載入，這樣單一檔案不需要旁邊的 leaderboard.js
        b64 = base64.b64encode(lb.read_bytes()).decode()
        out = out.replace("from './leaderboard.js'", f"from 'data:text/javascript;base64,{b64}'")
    OUT.write_text(out, encoding="utf-8")
    print(f"完成：{OUT.name}，{len(games)} 款遊戲，{OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
