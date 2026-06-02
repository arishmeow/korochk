const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.json');

// Инициализация базы данных
function initDB() {
    if (!fs.existsSync(DB_PATH)) {
        const initialData = {
            users: [
                // Админ создается автоматически
                {
                    id: 1,
                    login: 'admin',
                    password: 'admin123',
                    fullName: 'Администратор',
                    phone: '8(999)999-99-99',
                    email: 'admin@example.com',
                    role: 'admin'
                }
            ],
            applications: [],
            nextId: {
                users: 2,
                applications: 1
            }
        };
        fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function saveDB(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// ============= ПОЛЬЗОВАТЕЛИ =============

function getUserByLogin(login) {
    const db = initDB();
    return db.users.find(u => u.login === login);
}

function getUserById(id) {
    const db = initDB();
    return db.users.find(u => u.id === id);
}

function createUser(userData) {
    const db = initDB();
    
    // Проверка на существование логина
    if (db.users.find(u => u.login === userData.login)) {
        return null;
    }
    
    const newUser = {
        id: db.nextId.users++,
        ...userData,
        role: 'user'
    };
    
    db.users.push(newUser);
    saveDB(db);
    return newUser;
}

// ============= ЗАЯВКИ =============

function getApplicationsByUser(userId) {
    const db = initDB();
    return db.applications.filter(a => a.userId === userId);
}

function getAllApplications() {
    const db = initDB();
    // Добавляем данные пользователя к каждой заявке
    return db.applications.map(app => {
        const user = getUserById(app.userId);
        return {
            ...app,
            fullName: user ? user.fullName : '',
            phone: user ? user.phone : '',
            email: user ? user.email : ''
        };
    });
}

function createApplication(applicationData) {
    const db = initDB();
    
    const newApplication = {
        id: db.nextId.applications++,
        ...applicationData,
        status: 'Новая',
        reviewText: null,
        createdAt: new Date().toISOString()
    };
    
    db.applications.push(newApplication);
    saveDB(db);
    return newApplication;
}

function updateApplicationStatus(id, status) {
    const db = initDB();
    const app = db.applications.find(a => a.id === id);
    
    if (app) {
        app.status = status;
        saveDB(db);
        return true;
    }
    return false;
}

function addReview(applicationId, reviewText) {
    const db = initDB();
    const app = db.applications.find(a => a.id === applicationId);
    
    if (app) {
        app.reviewText = reviewText;
        saveDB(db);
        return true;
    }
    return false;
}

function getApplicationById(id) {
    const db = initDB();
    return db.applications.find(a => a.id === id);
}

// ============= СЕССИИ (простая реализация) =============

const sessions = new Map();

function createSession(userId) {
    const sessionId = Math.random().toString(36).substring(2, 15);
    sessions.set(sessionId, { userId, createdAt: Date.now() });
    return sessionId;
}

function getSession(sessionId) {
    const session = sessions.get(sessionId);
    if (session && Date.now() - session.createdAt < 24 * 60 * 60 * 1000) {
        return session;
    }
    sessions.delete(sessionId);
    return null;
}

function deleteSession(sessionId) {
    sessions.delete(sessionId);
}

module.exports = {
    initDB,
    getUserByLogin,
    getUserById,
    createUser,
    getApplicationsByUser,
    getAllApplications,
    createApplication,
    updateApplicationStatus,
    addReview,
    getApplicationById,
    createSession,
    getSession,
    deleteSession
};