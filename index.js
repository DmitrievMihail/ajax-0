let data=[];
const citiesListHTML = document.getElementById('citiesList');
const cities = []; // список городов
const weather = localStorage.hasOwnProperty('weather') ? JSON.parse(localStorage.getItem('weather')) : []; // Главный массив погоды
const outputHTML = document.getElementById('output'); // тег для вывода информации
const cityHTML =  document.getElementById('city');
const submit = document.getElementById('submit');

function createOptionsSelector(resp){
    const cities = cityList(resp);
    //console.log(cities[1]);

    // Заполняем список стран для подсказки в инпутах
    cities.forEach((cityObj, cityNum) => {
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
		'X-RapidAPI-Host': 'city-list.p.rapidapi.com'
	}
};

// Загрузка списка городов с географическими координатами через API
// TODO заменить нафиг этот сервис - треть городов нету, треть с орфографическими ошибками
try {
    fetch('https://city-list.p.rapidapi.com/api/getCity/ru', APIoptions)
        .then(response => response.json())
        .then(response => createOptionsSelector(response[0]))
        .catch(err => errorLoadingCities() );
} catch (error) {
    errorLoadingCities();
}

function errorLoadingCities(){
    // TODO убрать innerHTML
    document.getElementById('form').innerHTML = ('<h1>Произошла сетевая ошибка</h1>'+
    'При загрузке городов и их координат произошла сетевая ошибка.<br>'+
    'Прогноз погоды предоставить невозможно<br><br><b><a href="#">Обновите страницу</b>');
}

const rusLetters=new Map(); // Русские символы для сверки названий городов
"АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЬЫЪЭЮЯ абвгдеёжзийклмнопрстуфхцчшщьыъэюя".split('').forEach((char) => {
    rusLetters.set(char,char.codePointAt(0))
});



function cityList(response){
    //data =  JSON.parse(JSON.stringify(response));

    for (const key in response) {
        if (response[key].level.slice(0,3) == "ADM" || response[key].population < 10000) {
            // отбрасываем административные единицы (не города) и пункты с населением менее 10тыс
            continue;
        }

        let cityNameRu = response[key].name;
        // Этот большой цикл - пытается вытащить русское название
        // (сервер английские, русские и даже китайские вперемешку шлёт)
        for (const cityName of JSON.parse(response[key].alternames)) {
            let rusLng = true;
            if(cityName){
                for (const char of cityName) {
                    if (!rusLetters.has(char)){
                        rusLng = false;
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
            name : cityNameRu, // + " " + response[key].level,
            lat : response[key].lat,
            long : response[key].long,
            population : response[key].population,
        })
    }

    cityHTML.disabled = false;
    submit.disabled = false;

    return cities;
}

async function LoadWether(cityIndex){
    const APIoptions = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': '64e6599f99msh772610806e4b56ep19a156jsnd6d623b769f8',
            'X-RapidAPI-Host': 'weatherbit-v1-mashape.p.rapidapi.com'
        }
    };    
    try {
        const response = await fetch('https://weatherbit-v1-mashape.p.rapidapi.com/forecast/3hourly?'+
            'lat=' + cities[cityIndex].lat + '&lon=' + cities[cityIndex].long + '&lang=ru', APIoptions).catch(err => console.error(err));;
        const weatherJSON = await response.json();

        if (!weatherJSON || !weatherJSON.data) {
            outputHTML.innerHTML = 'Ошибка получения погоды. Проблема API';
            console.log('Ошибка API');
        } else {
            // Получили результат - записали в сторадж
            weather[cityIndex] = weatherJSON;
            localStorage.setItem('weather', JSON.stringify(weather));
            outputHTML.innerHTML += '<br>Данные получены';
            console.log('Погода пришла');
        }
    } catch (err) {
        // TODO  сделать ошибку по-человечески, сделать несколько попыток запроса погоды
        outputHTML.innerHTML = 'Ошибка получения погоды. Сетевая проблема';
        console.log('Сетевая ошибка');
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    cityHTML.disabled = true;
    submit.disabled = true;
    outputHTML.innerHTML = '';
    console.log('Начинаем обработку');
    const cityIndex = cities.findIndex(el => el.name == cityHTML.value)
    console.log('Индекс города', cityIndex);
    if (cityIndex !== -1) {
  
        if(!weather[cityIndex]){
            // Погоду ранее не получали, значит надо идти на сервер
            await LoadWether(cityIndex);
        }

        // Получены все данные. Рисуем прогноз погоды.

        // Поля для итерации
        const fields = {
            'timestamp_local': 'Дата/время (местные)',
            'temp' : 'Температура',
            'app_temp' : 'Ощущается как',
            'wind_cdir_full' : 'Направление ветра',
            'wind_spd' : 'Скорость ветра',
            'weather.description' : 'Явления',
            'clouds' : 'Процент облачности'
        };

        // TODO  сделать вывод по-человечески, а не через innerHTML
        html = '<h3>Прогноз погоды по городу <span style="color:blue">' + cities[cityIndex].name + '</span></h3>';
        if (!weather[cityIndex] || !weather[cityIndex].data) {
            html += '<b style="color:red">Прогноз недоступен, попробуйте узнать погоду ещё раз</b>';
            console.log('Погоды нету');
        } else {
            console.log('Погода есть, рисуем таблицу');
            html += '<table border=1><tr>';
            for (const field in fields) {
                html += '\n<th>' + fields[field] + '</th>';
            }
            html += "</tr>";
            for (currentWeather of weather[cityIndex].data) {
                html += '\n<tr style="text-align:center;">';
                for (const field in fields) {
                    if(field.indexOf('.')==-1) {
                        html += "\n<td>" + currentWeather[field] + "</td>";
                    } else {
                        const subfields = field.split('.');
                        html += "\n<td>" + currentWeather[subfields[0]][subfields[1]] + "</td>";
                    }
                }
                html += "\n</tr>";
            }
            html += "\n</table>";
        }

        outputHTML.innerHTML = html;
        cityHTML.disabled = false;
        submit.disabled = false;        
    }
})
