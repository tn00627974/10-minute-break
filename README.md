# 下課十分鐘：小遊戲大廳

```
index.html              大廳：遊戲清單、分類、網址路由、iframe 容器
games/*.html            每款遊戲一個獨立的完整網頁，彼此互不影響
thumbs/*.jpg            大廳卡片用的封面（300×400）
tools/build_single.py   把整個專案打包成一個 HTML 檔
```

## 兩種用法

**放上網站**：把整個資料夾上傳到 GitHub Pages、Netlify、Cloudflare Pages 之類的靜態主機。本機測試可以在資料夾裡執行 `python -m http.server 8000`，再打開 http://localhost:8000 。

**單一檔案**：執行 `python tools/build_single.py`，會產生 `下課十分鐘.html`，所有遊戲和封面都在裡面，點兩下就能玩，可以直接傳給別人。改過任何遊戲之後，要重新執行一次。

不要直接在壓縮檔裡點 index.html，那樣旁邊的 games 和 thumbs 資料夾不會跟著出來，遊戲會載不到。

## 加一款新遊戲

1. 把遊戲做成一個完整的 HTML 檔，放進 `games/`，例如 `games/racing.html`。
2. 放一張 3:4 的封面到 `thumbs/racing.jpg`。
3. 在 index.html 的 `GAMES` 陣列加一筆：

```js
{ id: 'racing', title: '夜市賽車', cat: '動作', desc: '一句話介紹。', best: score('racing.best', '分') },
```

遊戲裡用 `localStorage.setItem('racing.best', 分數)` 存最高分，大廳的卡片就會顯示出來。

## 月光鋼琴加曲目

打開 `games/piano.html`，在 `SONGS` 陣列最後面加一筆（加在最後，玩家之前選過的曲子才不會對錯）：

```js
{ name: '曲名', group: '童謠', score: '1 1 5 5 | 6 6 5 - | 4 4 3 3 | 2 2 1 -' },
```

- `group` 決定放在選曲列的哪一組：童謠、節日、名曲。
- 1 到 7 是 Do 到 Si，1 是中央 Do。
- 高八度在後面加 `'`（`1'`），低八度加 `,`（`5,`）。升半音寫 `#4`，降半音寫 `b7`。
- 空格、`|`、`-`、`0` 都會略過，遊戲只看音的順序。
- 想整首移調可以加 `key: 'G'`，這樣 1 就是 G。

不想改程式的話，玩家也可以在遊戲裡按「＋ 自己加一首」貼簡譜，那首歌只存在他自己的瀏覽器裡。

## 網址

`index.html#piano` 會直接打開月光鋼琴，可以拿來分享某一款遊戲；瀏覽器的上一頁會回到大廳。

## 後台遊玩紀錄

每玩完一局，大廳都會在 Firestore 的 `plays` 集合新增一筆，沒破紀錄、0 分、沒取名字的局也會記。這份資料跟排行榜分開，網頁上讀不到，只能到 Firebase Console → Firestore 查看。

| 欄位       | 內容                                                         |
| ---------- | ------------------------------------------------------------ |
| `game`   | 遊戲代號（踩地雷是 `mines-easy` 這種）                     |
| `score`  | 這局的分數（踩地雷是秒數）                                   |
| `name`   | 玩家名字，沒取名字的話是 `null`                            |
| `device` | 每台瀏覽器第一次玩時產生的隨機代碼，可以用來分辨沒取名字的人 |
| `at`     | 伺服器時間                                                   |

Firestore 安全規則要允許 `plays` 新增、不允許讀取，apiKey 改成 `YOUR...` 開頭時，紀錄會改存在瀏覽器的 `arcade.mockplays`。
