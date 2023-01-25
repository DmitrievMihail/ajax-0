const citiesListHTML = document.getElementById('citiesList');
const cities = []; // список городов
const weather = localStorage.hasOwnProperty('weather') ? JSON.parse(localStorage.getItem('weather')) : []; // Главный массив погоды
const outputHTML = document.getElementById('output'); // тег для вывода информации
const cityHTML = document.getElementById('city');
const submit = document.getElementById('submit');
const form = document.getElementById('form');
const debug = true; // Включение отладки
const errors = {
    noError: 0,
    errorLoadingCities: 1,
    errorCountCities: 2,
};
const errorsMsgList = [
    'Ошибки отсутствуют',
    'При загрузке городов и их координат произошла сетевая ошибка',
    'Неверный формат ответа сервера',
];

const rusLetters = new Map(); // Русские символы для сверки названий городов (для идиотского API)
'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЬЫЪЭЮЯ абвгдеёжзийклмнопрстуфхцчшщьыъэюя'.split('').forEach((char) => {
    rusLetters.set(char, char.codePointAt(0));
});

function createOptionsSelector(resp) {
    const cities = generateCityList(resp);
    debug && console.log('Загружено городов', cities.length);
    if (!cities.length) {
        throw new Error(); // Загрузили какую-то фигню а не города, вываливаемся в errorLoadingCities
    }
    // Заполняем список городов для работы инпута
    cities.forEach((cityObj) => {
        const option = document.createElement('option');
        option.value = cityObj.name;
        citiesListHTML.appendChild(option);
    });
}

cityHTML.disabled = true;
submit.disabled = true;

// Настройки для API-сервера
const APIoptions = {
    method: 'GET',
    headers: {
        'X-RapidAPI-Key': '64e6599f99msh772610806e4b56ep19a156jsnd6d623b769f8',
        'X-RapidAPI-Host': 'city-list.p.rapidapi.com',
    },
};

debug && console.log('Идёт загрузка городов');
// Загрузка списка городов с географическими координатами через API
// TODO заменить нафиг этот сервис - треть городов нету, треть с орфографическими ошибками

fetch('https://city-list.p.rapidapi.com/api/getCity/ru', APIoptions)
    .then((response) => response.json())
    .then((response) => createOptionsSelector(response[0]))
    .catch(() => errorLoadingCities());

function errorLoadingCities() {
    // TODO убрать innerHTML
    form.innerHTML =
        `<h1>Произошла ошибка</h1><b>Ошибка загрузки городов</b>.<br>` +
        `<br><span style='color:red;'>Прогноз погоды предоставить невозможно</span><br><br><b><a href="#">Обновите страницу</b>`;
    throw new Error('Ошибка загрузки городов');
}

function generateCityList(response) {
    for (const key in response) {
        if (response[key].level.slice(0, 3) === 'ADM' || response[key].population < 10000) {
            // отбрасываем административные единицы (не города) и пункты с населением менее 10тыс
            // eslint-disable-next-line no-continue
            continue;
        }

        let cityNameRu = response[key].name;
        // Этот большой цикл - пытается вытащить русское название
        // (сервер английские, русские и даже китайские вперемешку шлёт)
        for (const cityName of JSON.parse(response[key].alternames)) {
            let rusLng = true;
            if (cityName) {
                for (const char of cityName) {
                    if (!rusLetters.has(char)) {
                        rusLng = false;
                        // eslint-disable-next-line no-continue
                        continue;
                    }
                }
            }
            if (rusLng && cityName) {
                cityNameRu = cityName;
                break;
            }
        }

        cities.push({
            name: cityNameRu, // + " " + response[key].level,
            lat: response[key].lat,
            long: response[key].long,
            population: response[key].population,
        });
    }

    cityHTML.disabled = false;
    submit.disabled = false;

    return cities;
}

function errorLoadingWether() {
    // TODO убрать innerHTML
    cityHTML.disabled = false;
    submit.disabled = false;

    outputHTML.innerHTML =
        '<b style="color:red;">Ошибка загрузки погоды.</b><br><br> Попробуйте позднее или выберите другой город';
    throw new Error('Ошибка получения погоды.');
}

async function loadWether(cityIndex) {
    const APIoptions = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': '64e6599f99msh772610806e4b56ep19a156jsnd6d623b769f8',
            'X-RapidAPI-Host': 'weatherbit-v1-mashape.p.rapidapi.com',
        },
    };

    const response = await fetch(
        `https://weatherbit-v1-mashape.p.rapidapi.com/forecast/3hourly?lat=${cities[cityIndex].lat}&lon=${cities[cityIndex].long}&lang=ru`,
        APIoptions
    )
        .then((response) => response.json())
        .catch(() => errorLoadingWether());

    // Получили результат - записали в сторадж
    weather[cityIndex] = response;
    localStorage.setItem('weather', JSON.stringify(weather));
    outputHTML.innerHTML += '<br>Данные получены';
    debug && console.log('Погода пришла');
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    cityHTML.disabled = true;
    submit.disabled = true;
    outputHTML.innerHTML = '';
    debug && console.log('Начинаем обработку');
    // eslint-disable-next-line eqeqeq
    const cityIndex = cities.findIndex((el) => el.name == cityHTML.value);
    debug && console.log('Индекс города', cityIndex);
    if (cityIndex !== -1) {
        if (!weather[cityIndex]) {
            // Погоду ранее не получали, значит надо идти на сервер
            debug && console.log('Идём за погодой на сервер');
            await loadWether(cityIndex);
        }
        // Получены все данные. Рисуем прогноз погоды.

        // Поля для итерации
        const fields = {
            // eslint-disable-next-line camelcase
            timestamp_local: 'Дата/время (местные)', // здесь и далее camelcase приходит свыше
            temp: 'Температура',
            // eslint-disable-next-line camelcase
            app_temp: 'Ощущается как',
            // eslint-disable-next-line camelcase
            wind_cdir_full: 'Направление ветра',
            // eslint-disable-next-line camelcase
            wind_spd: 'Скорость ветра',
            'weather*description': 'Явления', // Звёздачка как разделитель полей (вложенный JSON)
            clouds: 'Процент облачности',
        };

        // TODO  сделать вывод по-человечески, а не через innerHTML
        let html = `<h3>Прогноз погоды по городу <span style="color:blue">${cities[cityIndex].name}</span></h3>`;
        if (!weather[cityIndex] || !weather[cityIndex].data) {
            html += '<b style="color:red">Прогноз недоступен, попробуйте узнать погоду позднее или выберите другой город</b>';
            debug && console.log('Погоды нету');
        } else {
            debug && console.log('Погода есть, рисуем таблицу');
            html += '<table border=1><tr>';
            for (const field in fields) {
                html += `\n<th>${fields[field]}</th>`;
            }
            html += '</tr>';
            for (const currentWeather of weather[cityIndex].data) {
                html += '\n<tr style="text-align:center;">';
                for (const field in fields) {
                    if (field.indexOf('*') === -1) {
                        html += `\n<td>${currentWeather[field]}</td>`;
                    } else {
                        const subfields = field.split('*');
                        html += `\n<td>${currentWeather[subfields[0]][subfields[1]]}</td>`;
                    }
                }
                html += '\n</tr>';
            }
            html += '\n</table>';
        }

        outputHTML.innerHTML = html;
        cityHTML.disabled = false;
        submit.disabled = false;
    }
});
