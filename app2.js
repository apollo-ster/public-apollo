const express = require('express'); // Expressフレームワークを読み込む。Webサーバーえお作れる
const bodyParser = require('body-parser'); //リクエストボディ(フォームデータなど）を取り出すためのミドルウェアを読み込む
const app = express(); // Expressアプリケーションを作成
const mongoose = require('mongoose'); //MongoDBと接続するためのライブラリMongooseを読み込む。
const bcrypt = require('bcrypt'); //パスワードをハッシュ化（暗号化）するためのライブラリ。
const session = require('express-session'); //ログイン情報を保持するセッション管理のためのライブラリ。

//ローカルMongoDBサーバーに接続。データベース名は chat_app。
mongoose.connect('mongodb://localhost:27017/chat_app', {
    useNewUrlParser: true, //接続設定で新しいURLパーサーとトポロジーエンジンを使う指定。
    useUnifiedTopology: true,
});

//ユーザー情報（ユーザー名とパスワード）を保存するためのスキーマ（設計図）を作成。
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true }, //usernameはユニーク（重複禁止）。
  password: String,
});

const User = mongoose.model('User', userSchema); //このスキーマからUserモデル（操作用オブジェクト）を作成。

let messages = [];//サーバー内にメッセージを保存する配列を作成。（メモリ保存なのでサーバー再起動すると消える）

// EJSを使うための設定
app.set('view engine', 'ejs'); //テンプレートエンジンにEJS（HTMLを簡単に生成できるやつ）を設定。
// ボディパーサーの設定
app.use(bodyParser.urlencoded({ extended: true })); //フォームから送られてきたデータを使えるようにする。

// publicフォルダーを使うための設定
app.use(express.static(__dirname +'/public')); ///publicフォルダにあるCSSとかJSファイルをそのまま提供できるようにする。

//セッション設定。
app.use(session({
  secret: 'secret_key', //secret_keyでセッションIDを暗号化。
  resave: false, //必要なときだけセッションを保存する設定。
  saveUninitialized: false,
}));

// ホームページを表示するルートハンドラ
app.get('/', (req, res) => { // /にアクセスされたら index.ejs を表示。
  res.render('index', {messages: messages, user: req.session.user}); // メッセージ一覧とログイン中のユーザー情報を渡す。messagesとuserを渡す
});

// フォームを受け取るルートハンドラ
app.post('/send', (req, res) => { //メッセージ送信フォームを受け取るルート。
  if (!req.session.user) return res.redirect('/login');// ログインしていない場合はログインページにリダイレクト

  const username = req.session.user.username; //ログイン中のユーザー名を取得。
  const message = req.body.message; // ログイン中のフォームから送られたメッセージを取得。

  messages.unshift({text: message, username: username}); //メッセージを先頭に追加（新しい順に並べる）。

  if (messages.length > 20) {
    messages = messages.slice(0, 20); // メッセージが20件を超えたら古いものを削除
  }
  res.redirect('/'); //送信後ホームにリダイレクト。
});

// 登録ページ（HTMLフォーム表示）
app.get('/register', (req, res) => { // /register にアクセスされたら register.ejs を表示。
  res.render('register'); // views/register.ejs を表示
});

// 登録処理
app.post('/register', async (req, res) => { //登録フォームからデータを受け取る。
  const { username, password } = req.body; //フォームからユーザー名とパスワードを取得。
  const hashedPassword = await bcrypt.hash(password, 10); // パスワードをハッシュ化（10回のソルトラウンド）。
  const user = new User({ username, password: hashedPassword }); //新しいユーザーを作成。

  try { //保存成功したらログインページへリダイレクト。
    await user.save(); // ユーザーをデータベースに保存
    res.redirect('/login'); // 登録後にログインページへリダイレクト
  } 
  catch (err) { //失敗したらエラーメッセージを返す。
    res.status(400).send('ユーザー名はすでに存在します。');
  }
});

// ログインページ（HTMLフォーム表示）
app.get('/login', (req, res) => { ///loginにアクセスしたら
  res.render('login'); // views/login.ejs を表示
}); 

// ログイン処理
app.post('/login', async (req, res) => { //ログインフォームからデータを受け取る。
  const { username, password } = req.body; //フォームからユーザー名とパスワードを取得。
  const user = await User.findOne({ username }); //ユーザー名でデータベースからユーザーを検索。
  if (!user) return res.send('ユーザーが見つかりません'); //ユーザーが見つからなかったらエラーメッセージを返す。

  const match = await bcrypt.compare(password, user.password);//パスワードが一致するか確認。
  if (!match) return res.send('パスワードが違います');//パスワードが違ったらエラーメッセージを返す。

  req.session.user = user; // セッションにユーザーを保存
  res.redirect('/'); //ログイン成功したらホームにリダイレクト。
});

// ログアウト
app.get('/logout', (req, res) => { // /logout にアクセスされたら
  req.session.destroy(() => { //セッションを破棄してログアウト。
  // (req.session は今ログインしているユーザーのセッション情報を持っている。)
  //destroy() を呼び出すと、そのセッションデータ（ログイン情報）がサーバー側から完全に削除される。
    res.redirect('/'); //ログアウト後ホームにリダイレクト。
  });
});

// サーバーを起動
const PORT =process.env.PORT || 3000; //ポート番号を指定。環境変数PORTがあればそれを使う。なければ3000。
app.listen(PORT, () => { //サーバー起動時にメッセージを表示。
  console.log(`Server is running on port ${PORT}`); //サーバーが起動したらメッセージを表示。
});

//セッションとは・・・ログイン情報を保持するための仕組み。
//セッションを使うことで、ユーザーがログインしているかどうかを確認したり、ログイン情報を保持したりできる。