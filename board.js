const express = require('express');
const mysql = require('mysql');
const bodyParser = require('body-parser');
const session = require('express-session');
const moment = require('moment');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true
}));

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '0000',
    database: 'bulletin_board'
});

connection.connect();

app.set('view engine', 'ejs');
app.set('views', './views');

app.get('/', (req, res) => {
    res.redirect('/login');
});

app.get('/login', (req, res) => {
    res.render('login_page', { message: req.query.message });
});

app.post('/login', (req, res) => {
    const { user_id, password } = req.body;
    const query = 'SELECT * FROM users WHERE user_id = ? AND password = ?';
    connection.query(query, [user_id, password], (error, results) => {
        if (results.length > 0) {
            req.session.user_id = user_id;
            res.redirect('/main?message=로그인 성공');
        } else {
            res.redirect('/login?message=아이디와 비밀번호를 다시 확인해 주세요.');
        }
    });
});

app.post('/register', (req, res) => {
    const { user_id, password } = req.body;
    const checkUserQuery = 'SELECT * FROM users WHERE user_id = ?';
    const registerQuery = 'INSERT INTO users (user_id, password) VALUES (?, ?)';
    
    connection.query(checkUserQuery, [user_id], (error, results) => {
        if (results.length > 0) {
            res.redirect('/login?message=중복되는 아이디가 있습니다.');
        } else {
            connection.query(registerQuery, [user_id, password], (error, results) => {
                if (error) {
                    res.redirect('/login');
                } else {
                    res.redirect('/login?message=성공적으로 회원가입이 완료되었습니다.');
                }
            });
        }
    });
});

app.get('/main', (req, res) => {
    if (!req.session.user_id) {
        res.redirect('/login');
    } else {
        const page = req.query.page ? parseInt(req.query.page) : 1;
        const limit = 10;
        const offset = (page - 1) * limit;

        const countQuery = 'SELECT COUNT(*) AS count FROM posts';
        const query = 'SELECT * FROM posts ORDER BY creation_date DESC LIMIT ? OFFSET ?';

        connection.query(countQuery, (countError, countResults) => {
            const totalPosts = countResults[0].count;
            const totalPages = Math.ceil(totalPosts / limit);

            connection.query(query, [limit, offset], (error, results) => {
                results.forEach(post => {
                    post.creation_date = moment(post.creation_date).format('YYYY-MM-DD HH:mm:ss');
                });
                res.render('main_page', { posts: results, user_id: req.session.user_id, message: req.query.message, page, totalPages });
            });
        });
    }
});

app.post('/post', (req, res) => {
    if (!req.session.user_id) {
        res.redirect('/login');
    } else {
        const { title, content } = req.body;
        const author_id = req.session.user_id;
        const query = 'INSERT INTO posts (title, content, author_id) VALUES (?, ?, ?)';
        connection.query(query, [title, content, author_id], (error, results) => {
            res.redirect('/main');
        });
    }
});

app.get('/post/:id', (req, res) => {
    const post_id = req.params.id;
    const user_id = req.session.user_id;
    const postQuery = 'SELECT * FROM posts WHERE post_id = ?';
    const commentsQuery = 'SELECT * FROM comments WHERE post_id = ? ORDER BY comment_id ASC';
    const userLikedQuery = 'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?';

    connection.query(postQuery, [post_id], (error, postResults) => {
        connection.query(commentsQuery, [post_id], (error, commentResults) => {
            connection.query(userLikedQuery, [post_id, user_id], (error, likeResults) => {
                postResults[0].creation_date = moment(postResults[0].creation_date).format('YYYY-MM-DD HH:mm:ss');
                commentResults.forEach(comment => {
                    comment.creation_date = moment(comment.creation_date).format('YYYY-MM-DD HH:mm:ss');
                });

                const userLiked = likeResults.length > 0;
                res.render('detail_page', { post: postResults[0], comments: commentResults, user_id: req.session.user_id, userLiked });
            });
        });
    });
});


app.post('/comment', (req, res) => {
    if (!req.session.user_id) {
        res.redirect('/login');
    } else {
        const { post_id, content } = req.body;
        const author_id = req.session.user_id;
        const query = 'INSERT INTO comments (post_id, content, author_id) VALUES (?, ?, ?)';
        connection.query(query, [post_id, content, author_id], (error, results) => {
            res.redirect(`/post/${post_id}`);
        });
    }
});

app.post('/deletePost', (req, res) => {
    const { post_id } = req.body;
    const query = 'DELETE FROM posts WHERE post_id = ?';
    connection.query(query, [post_id], (error, results) => {
        res.redirect('/main');
    });
});

app.post('/deleteComment', (req, res) => {
    const { comment_id, post_id } = req.body;
    const query = 'DELETE FROM comments WHERE comment_id = ?';
    connection.query(query, [comment_id], (error, results) => {
        res.redirect(`/post/${post_id}`);
    });
});

app.post('/likePost', (req, res) => {
    if (!req.session.user_id) {
        res.redirect('/login');
    } else {
        const { post_id } = req.body;
        const user_id = req.session.user_id;
        const checkLikeQuery = 'SELECT * FROM post_likes WHERE post_id = ? AND user_id = ?';
        const addLikeQuery = 'INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)';
        const removeLikeQuery = 'DELETE FROM post_likes WHERE post_id = ? AND user_id = ?';
        const incrementLikesQuery = 'UPDATE posts SET likes = likes + 1 WHERE post_id = ?';
        const decrementLikesQuery = 'UPDATE posts SET likes = likes - 1 WHERE post_id = ?';

        connection.query(checkLikeQuery, [post_id, user_id], (error, results) => {
            if (results.length === 0) {
                // 좋아요 추가
                connection.query(addLikeQuery, [post_id, user_id], (error, results) => {
                    connection.query(incrementLikesQuery, [post_id], (error, results) => {
                        res.redirect(`/post/${post_id}`);
                    });
                });
            } else {
                // 좋아요 취소
                connection.query(removeLikeQuery, [post_id, user_id], (error, results) => {
                    connection.query(decrementLikesQuery, [post_id], (error, results) => {
                        res.redirect(`/post/${post_id}`);
                    });
                });
            }
        });
    }
});


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        res.redirect('/login');
    });
});

app.listen(3000, () => {
    console.log('서버가 3000번 포트에서 실행 중입니다');
});
