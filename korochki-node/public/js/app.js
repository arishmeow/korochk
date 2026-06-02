const slides = [
    'images/slide1.jpg',
    'images/slide2.jpg',
    'images/slide3.jpg',
    'images/slide4.jpg'
];

let currentSlide = 0;
let adminApplications = [];

document.addEventListener('DOMContentLoaded', () => {
    initSlider();
    initLoginForm();
    initRegisterForm();
    initApplicationForm();
    initLogoutButton();

    if (document.getElementById('applicationsList')) {
        loadUserApplications();
    }

    if (document.getElementById('adminTable')) {
        loadAdminApplications();
        initAdminFilter();
    }
});

function initSlider() {
    const image = document.getElementById('sliderImage');
    const prevButton = document.getElementById('prevSlide');
    const nextButton = document.getElementById('nextSlide');

    if (!image || !prevButton || !nextButton) return;

    function showSlide() {
        image.style.opacity = '0';

        setTimeout(() => {
            image.src = slides[currentSlide];
            image.style.opacity = '1';
        }, 120);
    }

    function nextSlide() {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide();
    }

    function prevSlide() {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide();
    }

    nextButton.addEventListener('click', nextSlide);
    prevButton.addEventListener('click', prevSlide);

    setInterval(nextSlide, 3000);
}

function initLoginForm() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const login = form.login.value.trim();
        const password = form.password.value.trim();

        if (!login || !password) {
            showMessage('Введите логин и пароль', 'error');
            return;
        }

        const result = await sendRequest('/api/login', 'POST', {
            login,
            password
        });

        if (!result.success) {
            showMessage(result.message, 'error');
            return;
        }

        if (result.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'applications.html';
        }
    });
}

function initRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const login = form.login.value.trim();
        const password = form.password.value.trim();
        const fullName = form.fullName.value.trim();
        const phone = form.phone.value.trim();
        const email = form.email.value.trim();

        if (!/^[A-Za-z0-9]{6,}$/.test(login)) {
            showMessage('Логин должен содержать латиницу и цифры, минимум 6 символов', 'error');
            return;
        }

        if (password.length < 8) {
            showMessage('Пароль должен быть минимум 8 символов', 'error');
            return;
        }

        if (!/^[А-Яа-яЁё\s]+$/.test(fullName)) {
            showMessage('ФИО должно содержать только кириллицу и пробелы', 'error');
            return;
        }

        if (!/^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/.test(phone)) {
            showMessage('Телефон должен быть в формате 8(XXX)XXX-XX-XX', 'error');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showMessage('Введите корректный email', 'error');
            return;
        }

        const result = await sendRequest('/api/register', 'POST', {
            login,
            password,
            fullName,
            phone,
            email
        });

        if (!result.success) {
            showMessage(result.message, 'error');
            return;
        }

        showMessage('Регистрация прошла успешно. Сейчас откроется страница входа.', 'success');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 900);
    });
}

function initApplicationForm() {
    const form = document.getElementById('applicationForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const courseName = form.courseName.value.trim();
        const startDate = form.startDate.value.trim();
        const paymentMethod = form.paymentMethod.value.trim();

        if (!courseName) {
            showMessage('Выберите курс', 'error');
            return;
        }

        if (!/^\d{2}\.\d{2}\.\d{4}$/.test(startDate)) {
            showMessage('Дата должна быть в формате ДД.ММ.ГГГГ', 'error');
            return;
        }

        if (!paymentMethod) {
            showMessage('Выберите способ оплаты', 'error');
            return;
        }

        const result = await sendRequest('/api/applications', 'POST', {
            courseName,
            startDate,
            paymentMethod
        });

        if (!result.success) {
            showMessage(result.message, 'error');
            return;
        }

        showMessage('Заявка успешно отправлена', 'success');

        setTimeout(() => {
            window.location.href = 'applications.html';
        }, 700);
    });
}

function initLogoutButton() {
    const button = document.getElementById('logoutButton');
    if (!button) return;

    button.addEventListener('click', async () => {
        await sendRequest('/api/logout', 'POST', {});
        window.location.href = 'index.html';
    });
}

async function loadUserApplications() {
    const container = document.getElementById('applicationsList');

    try {
        const result = await sendRequest('/api/applications', 'GET');

        if (!result.success) {
            container.innerHTML = `<div class="empty">${escapeHtml(result.message)}</div>`;
            return;
        }

        const applications = result.applications;

        if (applications.length === 0) {
            container.innerHTML = `
                <div class="empty">
                    У вас пока нет заявок. Создайте первую заявку на обучение.
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        applications.forEach((application) => {
            const card = document.createElement('article');
            card.className = 'application-card';

            let reviewBlock = '';

            if (application.reviewText) {
                reviewBlock = `
                    <div class="review-box">
                        <strong>Ваш отзыв:</strong>
                        <p>${escapeHtml(application.reviewText)}</p>
                    </div>
                `;
            } else if (application.status === 'Обучение завершено') {
                reviewBlock = `
                    <form class="form review-form" data-id="${application.id}">
                        <label>
                            Отзыв о качестве образовательных услуг
                            <textarea name="text" placeholder="Напишите ваш отзыв" required></textarea>
                        </label>

                        <button class="btn secondary" type="submit">
                            Отправить отзыв
                        </button>
                    </form>
                `;
            } else {
                reviewBlock = `
                    <p class="muted">
                        Отзыв можно оставить после завершения обучения.
                    </p>
                `;
            }

            card.innerHTML = `
                <h3>${escapeHtml(application.courseName)}</h3>

                <p>
                    <strong>Дата начала:</strong>
                    ${escapeHtml(application.startDate)}
                </p>

                <p>
                    <strong>Способ оплаты:</strong>
                    ${escapeHtml(application.paymentMethod)}
                </p>

                <p>
                    <strong>Статус:</strong>
                    <span class="status ${getStatusClass(application.status)}">
                        ${escapeHtml(application.status)}
                    </span>
                </p>

                ${reviewBlock}
            `;

            container.appendChild(card);
        });

        initReviewForms();

    } catch (error) {
        container.innerHTML = `
            <div class="empty">
                Не удалось загрузить заявки. Проверьте сервер.
            </div>
        `;
    }
}

function initReviewForms() {
    const forms = document.querySelectorAll('.review-form');

    forms.forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const applicationId = Number(form.dataset.id);
            const text = form.text.value.trim();

            if (!text) {
                showMessage('Введите текст отзыва', 'error');
                return;
            }

            const result = await sendRequest('/api/reviews', 'POST', {
                applicationId,
                text
            });

            if (!result.success) {
                showMessage(result.message, 'error');
                return;
            }

            showMessage('Отзыв успешно добавлен', 'success');
            loadUserApplications();
        });
    });
}

async function loadAdminApplications() {
    const table = document.getElementById('adminTable');

    try {
        const result = await sendRequest('/api/admin/applications', 'GET');

        if (!result.success) {
            table.innerHTML = `
                <tr>
                    <td colspan="9">${escapeHtml(result.message)}</td>
                </tr>
            `;
            return;
        }

        adminApplications = result.applications;
        renderAdminTable(adminApplications);

    } catch (error) {
        table.innerHTML = `
            <tr>
                <td colspan="9">
                    Не удалось загрузить заявки. Проверьте сервер.
                </td>
            </tr>
        `;
    }
}

function initAdminFilter() {
    const filter = document.getElementById('statusFilter');
    if (!filter) return;

    filter.addEventListener('change', () => {
        const status = filter.value;

        if (!status) {
            renderAdminTable(adminApplications);
            return;
        }

        const filtered = adminApplications.filter((application) => {
            return application.status === status;
        });

        renderAdminTable(filtered);
    });
}

function renderAdminTable(applications) {
    const table = document.getElementById('adminTable');

    if (applications.length === 0) {
        table.innerHTML = `
            <tr>
                <td colspan="9">Заявки не найдены.</td>
            </tr>
        `;
        return;
    }

    table.innerHTML = '';

    applications.forEach((application) => {
        const row = document.createElement('tr');

        row.innerHTML = `
            <td>${escapeHtml(application.fullName)}</td>
            <td>${escapeHtml(application.phone)}</td>
            <td>${escapeHtml(application.email)}</td>
            <td>${escapeHtml(application.courseName)}</td>
            <td>${escapeHtml(application.startDate)}</td>
            <td>${escapeHtml(application.paymentMethod)}</td>
            <td>
                <span class="status ${getStatusClass(application.status)}">
                    ${escapeHtml(application.status)}
                </span>
            </td>
            <td>${application.reviewText ? escapeHtml(application.reviewText) : '—'}</td>
            <td>
                <form class="admin-status-form" data-id="${application.id}">
                    <select name="status">
                        <option value="Новая" ${application.status === 'Новая' ? 'selected' : ''}>
                            Новая
                        </option>

                        <option value="Идет обучение" ${application.status === 'Идет обучение' ? 'selected' : ''}>
                            Идет обучение
                        </option>

                        <option value="Обучение завершено" ${application.status === 'Обучение завершено' ? 'selected' : ''}>
                            Обучение завершено
                        </option>
                    </select>

                    <button class="btn primary small" type="submit">Сохранить</button>
                </form>
            </td>
        `;

        table.appendChild(row);
    });

    initAdminStatusForms();
}

function initAdminStatusForms() {
    const forms = document.querySelectorAll('.admin-status-form');

    forms.forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const id = Number(form.dataset.id);
            const status = form.status.value;

            const result = await sendRequest(`/api/admin/applications/${id}/status`, 'PATCH', {
                status
            });

            if (!result.success) {
                showMessage(result.message, 'error');
                return;
            }

            showMessage('Статус заявки обновлен', 'success');
            loadAdminApplications();
        });
    });
}

async function sendRequest(url, method, body = null) {
    const options = {
        method,
        headers: {}
    };

    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        return await response.json();
    } catch (error) {
        console.error('Ошибка запроса:', error);
        return { success: false, message: 'Ошибка сети. Проверьте соединение.' };
    }
}

function showMessage(text, type = 'success') {
    const messageBox = document.getElementById('message');

    if (!messageBox) {
        alert(text);
        return;
    }

    messageBox.innerHTML = `
        <div class="alert ${type}">
            ${escapeHtml(text)}
        </div>
    `;

    messageBox.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    setTimeout(() => {
        if (messageBox.firstChild) {
            messageBox.firstChild.remove();
        }
    }, 5000);
}

function getStatusClass(status) {
    if (status === 'Новая') return 'new';
    if (status === 'Идет обучение') return 'progress';
    if (status === 'Обучение завершено') return 'done';
    return '';
}

function escapeHtml(value) {
    if (!value) return '';
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}