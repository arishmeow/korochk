const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db.js');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'korochki-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 1000 * 60 * 60 * 2
    }
}));

app.use(express.static(path.join(__dirname, 'public')));

// Инициализация базы данных
db.initDB();

// Middleware для проверки авторизации
function isUser(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: 'Необходимо войти в систему'
        });
    }
    next();
}

function isAdmin(req, res, next) {
    if (!req.session.isAdmin) {
        return res.status(403).json({
            success: false,
            message: 'Доступ разрешен только администратору'
        });
    }
    next();
}

// Валидация данных регистрации
function validateRegisterData(data) {
    const { login, password, fullName, phone, email } = data;

    if (!login || !password || !fullName || !phone || !email) {
        return 'Все поля обязательны для заполнения';
    }

    if (!/^[A-Za-z0-9]{6,}$/.test(login)) {
        return 'Логин должен содержать латиницу и цифры, минимум 6 символов';
    }

    if (password.length < 8) {
        return 'Пароль должен быть минимум 8 символов';
    }

    if (!/^[А-Яа-яЁё\s]+$/.test(fullName)) {
        return 'ФИО должно содержать только кириллицу и пробелы';
    }

    if (!/^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/.test(phone)) {
        return 'Телефон должен быть в формате 8(XXX)XXX-XX-XX';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return 'Введите корректный email';
    }

    return null;
}

// Конвертация даты из ДД.ММ.ГГГГ в ГГГГ-ММ-ДД
function convertDateToMysql(dateString) {
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateString)) {
        return null;
    }

    const [day, month, year] = dateString.split('.');
    const date = new Date(`${year}-${month}-${day}`);

    if (
        date.getFullYear() !== Number(year) ||
        date.getMonth() + 1 !== Number(month) ||
        date.getDate() !== Number(day)
    ) {
        return null;
    }

    return `${year}-${month}-${day}`;
}

// ============= API МАРШРУТЫ =============

app.get('/api/me', (req, res) => {
    if (req.session.isAdmin) {
        return res.json({
            authorized: true,
            role: 'admin'
        });
    }

    if (req.session.userId) {
        return res.json({
            authorized: true,
            role: 'user',
            fullName: req.session.fullName
        });
    }

    res.json({
        authorized: false
    });
});

app.post('/api/register', async (req, res) => {
    try {
        const login = String(req.body.login || '').trim();
        const password = String(req.body.password || '').trim();
        const fullName = String(req.body.fullName || '').trim();
        const phone = String(req.body.phone || '').trim();
        const email = String(req.body.email || '').trim();

        const validationError = validateRegisterData({
            login,
            password,
            fullName,
            phone,
            email
        });

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        // Проверка существования пользователя
        const existingUser = db.getUserByLogin(login);
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Пользователь с таким логином уже существует'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const newUser = db.createUser({
            login,
            password: passwordHash,
            fullName,
            phone,
            email
        });

        if (!newUser) {
            return res.status(400).json({
                success: false,
                message: 'Ошибка при создании пользователя'
            });
        }

        res.json({
            success: true,
            message: 'Регистрация прошла успешно'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при регистрации'
        });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const login = String(req.body.login || '').trim();
        const password = String(req.body.password || '').trim();

        if (!login || !password) {
            return res.status(400).json({
                success: false,
                message: 'Введите логин и пароль'
            });
        }

        // Админ-логин (оставляем как было)
        if (login === 'Admin' && password === 'KorokNET') {
            req.session.isAdmin = true;
            req.session.userId = null;
            req.session.fullName = null;

            return res.json({
                success: true,
                role: 'admin',
                message: 'Вход администратора выполнен'
            });
        }

        // Поиск пользователя
        const user = db.getUserByLogin(login);

        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Неверный логин или пароль'
            });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);

        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: 'Неверный логин или пароль'
            });
        }

        req.session.userId = user.id;
        req.session.fullName = user.fullName;
        req.session.isAdmin = false;

        res.json({
            success: true,
            role: 'user',
            message: 'Вход выполнен'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при авторизации'
        });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({
            success: true,
            message: 'Вы вышли из системы'
        });
    });
});

app.post('/api/applications', isUser, async (req, res) => {
    try {
        const courseName = String(req.body.courseName || '').trim();
        const startDate = String(req.body.startDate || '').trim();
        const paymentMethod = String(req.body.paymentMethod || '').trim();

        const allowedCourses = [
            'Основы алгоритмизации и программирования',
            'Основы веб-дизайна',
            'Основы проектирования баз данных'
        ];

        const allowedPaymentMethods = [
            'Наличными',
            'Переводом по номеру телефона'
        ];

        if (!allowedCourses.includes(courseName)) {
            return res.status(400).json({
                success: false,
                message: 'Выберите курс из списка'
            });
        }

        const mysqlDate = convertDateToMysql(startDate);

        if (!mysqlDate) {
            return res.status(400).json({
                success: false,
                message: 'Дата должна быть корректной и в формате ДД.ММ.ГГГГ'
            });
        }

        if (!allowedPaymentMethods.includes(paymentMethod)) {
            return res.status(400).json({
                success: false,
                message: 'Выберите способ оплаты'
            });
        }

        db.createApplication({
            userId: req.session.userId,
            courseName: courseName,
            startDate: mysqlDate,
            paymentMethod: paymentMethod
        });

        res.json({
            success: true,
            message: 'Заявка успешно отправлена'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при создании заявки'
        });
    }
});

app.get('/api/applications', isUser, async (req, res) => {
    try {
        const applications = db.getApplicationsByUser(req.session.userId);

        // Форматируем дату для фронтенда
        const formattedApplications = applications.map(app => ({
            id: app.id,
            courseName: app.courseName,
            startDate: app.startDate ? app.startDate.split('-').reverse().join('.') : '',
            paymentMethod: app.paymentMethod,
            status: app.status,
            reviewText: app.reviewText || null
        }));

        res.json({
            success: true,
            applications: formattedApplications
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при получении заявок'
        });
    }
});

app.post('/api/reviews', isUser, async (req, res) => {
    try {
        const applicationId = Number(req.body.applicationId);
        const text = String(req.body.text || '').trim();

        if (!applicationId || !text) {
            return res.status(400).json({
                success: false,
                message: 'Заполните текст отзыва'
            });
        }

        const application = db.getApplicationById(applicationId);

        if (!application || application.userId !== req.session.userId) {
            return res.status(404).json({
                success: false,
                message: 'Заявка не найдена'
            });
        }

        if (application.status !== 'Обучение завершено') {
            return res.status(400).json({
                success: false,
                message: 'Отзыв можно оставить только после завершения обучения'
            });
        }

        if (application.reviewText) {
            return res.status(400).json({
                success: false,
                message: 'Отзыв для этой заявки уже оставлен'
            });
        }

        db.addReview(applicationId, text);

        res.json({
            success: true,
            message: 'Отзыв успешно добавлен'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при добавлении отзыва'
        });
    }
});

app.get('/api/admin/applications', isAdmin, async (req, res) => {
    try {
        const applications = db.getAllApplications();

        res.json({
            success: true,
            applications
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при получении заявок'
        });
    }
});

app.patch('/api/admin/applications/:id/status', isAdmin, async (req, res) => {
    try {
        const applicationId = Number(req.params.id);
        const status = String(req.body.status || '').trim();

        const allowedStatuses = [
            'Новая',
            'Идет обучение',
            'Обучение завершено'
        ];

        if (!applicationId) {
            return res.status(400).json({
                success: false,
                message: 'Некорректный номер заявки'
            });
        }

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Некорректный статус заявки'
            });
        }

        const updated = db.updateApplicationStatus(applicationId, status);

        if (!updated) {
            return res.status(404).json({
                success: false,
                message: 'Заявка не найдена'
            });
        }

        res.json({
            success: true,
            message: 'Статус заявки обновлен'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Ошибка сервера при обновлении статуса'
        });
    }
});

app.use((req, res) => {
    res.status(404).send('Страница не найдена');
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
    console.log('База данных: data.json (файл создастся автоматически)');
    console.log('Логин администратора: Admin / Пароль: KorokNET');
});