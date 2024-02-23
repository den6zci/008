// localStorage
function getClickedLinks() {
    let nameStorage = 'selectedLinks' + window.location.search;
    return (localStorage.getItem(nameStorage) != undefined)
        ? JSON.parse(localStorage.getItem(nameStorage)) : [];
}
function setClickedLinks(link, selectedLinks) {
    let id = getLinkId(link);
    let nameStorage = 'selectedLinks' + window.location.search;
    if (!selectedLinks.includes(id)) {
        selectedLinks.push(id);
        localStorage.setItem(nameStorage, JSON.stringify(selectedLinks));
    }
}
function isClickedLink(link, selectedLinks) {
    let id = getLinkId(link);
    if (selectedLinks.includes(id)) {
        return true;
    }
    return false;
}
//link ID
function getLinkId(url) {
    let linkArr = url.split('/')
    return linkArr[linkArr.length - 2] + '/' + linkArr[linkArr.length - 1];
}
//log ID
function getLogId(url) {
    let parts = url.split('/');
    do {
        lastPart = parts.pop();
    } while (lastPart.trim() === "" && parts.length > 0);
    return lastPart;
}
//Формуємо посилання на лист (листи із сканами документів)
function getEmlUrl(fileUrl) {
    return fileUrl.replace('takeDir.php?n=', '/').replace('/alarm/', '/tmp/scan/').replace('_', '/').replace(/\/+$/, '.eml');
}

// Створюємо та додаємо елемент з текстом логу
async function loadTextFile(url, id) {
    try {
        const response = await fetch(url);
        const data = await response.text();
        const paragraph = document.createElement("p");
        paragraph.style.backgroundColor = '#333333';
        paragraph.style.color = '#e0e0e0';
        paragraph.textContent = data;
        const targetElement = document.getElementById(id);
        if (targetElement) {
            targetElement.appendChild(paragraph);
        } else {
            console.error(`Елемент з id "${id}" не знайдений.`);
        }
    } catch (error) {
        console.error('Помилка при завантаженні текстового файлу:', error);
    }
}

// Створюємо div з посиланнями
function getLinks(url, selectedLinks) {
    return fetch(url)
        .then(response => response.text())
        .then(data => {
            // Створюємо об'єкт DOM для обробки контенту
            let parser = new DOMParser();
            let htmlDoc = parser.parseFromString(data, 'text/html');
            // Знаходимо всі посилання (a) за допомогою селектора
            let links = htmlDoc.querySelectorAll('table a');
            // Створюємо новий елемент div
            let id = getLogId(url);
            let div = document.createElement('div');
            div.setAttribute('id', id);
            div.style.border = '5px solid black';
            div.style.marginBottom = '30px';
            div.style.backgroundColor = '#e0e0e0';
            // Додаємо кожне посилання до нового елемента div
            links.forEach(link => {
                let fileUrl = link.getAttribute("href");
                if (fileUrl.substr(fileUrl.length - 4) === ".log") {
                    if (fileUrl.includes("Eml_N")) {
                        loadTextFile(link, id);
                    }
                } else {
                    link.style.fontWeight = 'bold';
                    if (isClickedLink(fileUrl, selectedLinks)) {
                        link.style.color = '#b2b2b2';
                    } else if (fileUrl.substr(fileUrl.length - 4) === ".eml") {
                        link.style.color = '#cc0000';
                        link.classList.add('eml');
                        link.classList.add('doc');
                        link.removeAttribute('target');
                    } else {
                        link.style.color = '#cca300';
                    }
                }
                div.appendChild(link);
                div.appendChild(document.createElement('br'));
            });

            if (url.includes(".ip6")) {
                let emlLink = document.createElement('a');
                const emlUrl = getEmlUrl(url);
                emlLink.setAttribute('href', emlUrl);
                emlLink.innerHTML = emlUrl.split('/').pop();
                emlLink.style.fontWeight = 'bold';
                emlLink.style.color = isClickedLink(emlUrl, selectedLinks) ? '#b2b2b2' : '#cc0000';
                emlLink.classList.add('eml');
                emlLink.classList.add('img');
                emlLink.removeAttribute('target');
                div.appendChild(emlLink);
            }

            // Повертаємо новий елемент diva
            return div;
        })
        .catch(error => {
            console.error('Помилка:', error);
            return null;
        });
}

// Додаємо div на сторінку
function appendElements(selectedLinks) {
    let ids = [];
    let tableRows = document.querySelectorAll("table > tbody > tr");
    let chunkSize = 100;
    let delay = 1000; // 1 second delay

    let processChunk = function(chunk) {
        chunk.forEach(function(row) {
            let firstChild = row.children[0];
            if (firstChild) {
                let report = firstChild.children[0];
                if (report) {
                    let reportUrl = report.getAttribute("href");
                    report.style.color = "#b2b2b2";
                    if (reportUrl.includes("Eml_N") || reportUrl.includes(".ip6")) {
                        getLinks(reportUrl, selectedLinks).then(domObject => {
                            if (domObject) {
                                firstChild.appendChild(domObject);
                                ids.push(domObject.id);
                            } else {
                                console.error('Помилка отримання об\'єкта DOM');
                            }
                        });
                    }
                }
            }
        });
    };

    let processTableRow = function(index) {
        let start = index * chunkSize;
        let end = Math.min(start + chunkSize, tableRows.length - 1);
        let chunk = Array.from(tableRows).slice(start, end);
        processChunk(chunk);

        if (end < tableRows.length - 1) {
            setTimeout(function() {
                processTableRow(index + 1);
            }, delay);
        }
    };

    processTableRow(0);

    return ids;
}

/*----------------------- Автоматичне скачування -----------------------*/

// Функція для скачування файлів
async function clickLinks(selectedLinks, searchString) {
    // Перевіряємо наявність searchString
    if (searchString && typeof searchString === 'string') {
        let count = 0;
        const isTag = searchString.startsWith('#');
        const links = isTag
            ? document.getElementsByClassName(searchString.slice(1))
            : document.getElementsByClassName('eml');

        for (const link of links) {
            const fileUrl = link.getAttribute("href");
            // Перевіряємо ключове слово (тег) або присутність слова в параграфі (лог)
            if (!isClickedLink(fileUrl, selectedLinks)
                && (isTag || Array.from(link.parentNode.children).find((sibling) => sibling.tagName.toLowerCase() === 'p' && sibling.textContent.includes(searchString)))){
                // Створюємо подію кліку
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                // Чекаємо затримку перед кожним кліком
                await new Promise(resolve => setTimeout(resolve, 100));
                // Симулюємо клік на посиланні
                link.dispatchEvent(clickEvent);
                count++;
            }
        }
        console.log(count);
    }
}

// Функція для виклику при кліку на кнопку пошуку
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchString = searchInput.value.trim();
    // Виклик функції clickLinks з новим рядком пошуку
    clickLinks(selectedLinks, searchString);
}

// Додаємо елемент пошуку на сторінку
function appendSearchElement() {
    const searchContainer = document.createElement('div');
    searchContainer.id = 'searchContainer';
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'searchInput';
    input.style.padding = '1px 4px';
    input.style.minWidth = '200px';
    const button = document.createElement('button');
    button.textContent = '📥';
    button.onclick = performSearch;
    searchContainer.appendChild(input);
    searchContainer.appendChild(button);
    document.body.appendChild(searchContainer);
    searchContainer.style.position = 'fixed';
    searchContainer.style.top = '0';
    searchContainer.style.right = '0';
    searchContainer.style.padding = '10px';
    searchContainer.style.margin = '20px';
    searchContainer.style.transform = 'scale(1.5)';
    searchContainer.style.transformOrigin = 'top right';
    const optionsContainer = document.createElement('div');
    optionsContainer.id = 'optionsContainer';
    optionsContainer.style.backgroundColor = '#fff';
    optionsContainer.style.fontSize = 'smaller';
    searchContainer.appendChild(optionsContainer);
}

/*----------------------- Виконання -----------------------*/

// Отримуємо перелік посилань які вже натискали
let selectedLinks = getClickedLinks();

// Створюємо елементи з посиланнями
appendElements(selectedLinks);

// Додаємо обробник кліка до всього документу
document.addEventListener("click", function (event) {
    let target = event.target;
    // Перевіряємо чи клік був на посиланні
    if (target.tagName === "A") {
        let selectedLink = target.getAttribute('href');
        setClickedLinks(selectedLink, selectedLinks);
        target.style.color = "#b2b2b2";
    }

    // Перевіряємо, чи елемент, який спричинив подію, є полем вводу searchInput
    if (event.target && event.target.id === 'searchInput') {
        const userInput = event.target.value;
        // Отримуємо контейнер для випадаючого списку
        const optionsContainer = document.getElementById('optionsContainer');
        // Очищаємо попередні варіанти
        optionsContainer.innerHTML = '';
        // Якщо поле містить текст
        if (userInput) {
            const options = ['для службового користування', '#eml', '#doc', '#img'];
            // Фільтруємо варіанти за введеним текстом
            const filteredOptions = options.filter(option =>
                option.toLowerCase().startsWith(userInput.toLowerCase())
            );
            // Створюємо випадаючий список
            filteredOptions.forEach(option => {
                const listItem = document.createElement('div');
                listItem.textContent = option;
                listItem.classList.add('option');
                listItem. style.borderBottom = 'solid 1px #5d7a8c';
                // Додаємо обробник кліку для підстановки значення в поле вводу
                listItem.addEventListener('click', function () {
                    event.target.value = option;
                    optionsContainer.innerHTML = '';
                    event.target.focus();
                });
                // Додаємо елемент випадаючого списку до DOM
                optionsContainer.appendChild(listItem);
            });
        } else {
            // Створюємо випадаючий список по замовчуванні
            const options = ['для службового користування', '#eml', '#doc', '#img'];
            options.forEach(option => {
                const listItem = document.createElement('div');
                listItem.textContent = option;
                listItem.classList.add('option');
                listItem. style.borderBottom = 'solid 1px #5d7a8c';
                // Додаємо обробник кліку для підстановки значення в поле вводу
                listItem.addEventListener('click', function () {
                    event.target.value = option;
                    optionsContainer.innerHTML = '';
                    event.target.focus();
                });
                // Додаємо елемент випадаючого списку до DOM
                optionsContainer.appendChild(listItem);
            });
        }
    }

});

// Додаємо елемент пошуку на сторінку
appendSearchElement();

// Додаємо обробник подій для сторінки при натисканні Enter
document.body.addEventListener('keypress', function (e) {
    // Перевіряємо, чи натиснута клавіша Enter
    if (e.key === 'Enter') {
        // Перевіряємо, чи це подія від searchInput
        if (e.target && e.target.id === 'searchInput') {
            // Викликаємо функцію performSearch
            performSearch();
        }
    }
});