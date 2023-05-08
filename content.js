console.log("YT Music Console Log Extension is running!");

const setValue = (key, value) => {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, () => {
            resolve();
        });
    });
};
  
const getValue = (key) => {
    return new Promise((resolve) => {
        try {
            chrome.storage.local.get([key], (result) => {
                resolve(result[key]);
            });
        } catch (e) {
            console.log('Error getting value:', e);
            console.log('Key:', key);
            resolve(null);
        }
    });
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function retrieveArtistName(element) {
    let artistNameElement = element.querySelector('.secondary-flex-columns.ytmusic-responsive-list-item-renderer > yt-formatted-string');
    
    if (artistNameElement) {
        return artistNameElement.textContent;
    }

    return null;
}

function markAsDangerous(element) {
    element.style.backgroundColor = 'red';
}

async function fetchArtists(artistName) {
    const url = 'https://musicbrainz.org/ws/2/artist/?query=artist:' + encodeURIComponent(artistName) + '&fmt=json';
    const response = await fetch(url);
    const data = await response.json();

    return data;
}

async function fetchCountryCode(areaId) {
    const url = 'https://musicbrainz.org/ws/2/area/' + encodeURIComponent(areaId) + '?inc=area-rels&fmt=json';
    const response = await fetch(url);
    const data = await response.json();

    if (data.relations.length === 0) {
        return 'UNKNOWN';
    }

    const { area: { ['iso-3166-2-codes']: countryRawCode } } = data.relations[0];
    const countryCode = (countryRawCode + '').split('-')[0];

    return countryCode;
}

function makeSongJudgement(element, artistName, countryCode) {
    if (countryCode !== 'RU') {
        return;
    }
    
    console.log('Found Russian artist:', artistName);
    markAsDangerous(element);
    dislikeSong(element);
}

async function policeSongElement(element) {
    const artistName = retrieveArtistName(element);
    if (artistName === null) {
        return;
    }

    const cachedCountryCode = await getValue(artistName);

    if (cachedCountryCode) {
        makeSongJudgement(element, artistName, cachedCountryCode);
        return;
    }

    const { artists } = await fetchArtists(artistName);

    if (!artists || artists.length == 0) {
        console.log('No artists found for:', artistName);
        setValue(artistName, 'UNKNOWN');
        return;
    }

    const firstArtistMatch = artists[0];
    if (!firstArtistMatch.area) {
        console.log('No artists found for:', artistName);
        setValue(artistName, 'UNKNOWN');
        return;
    }

    const areaId = firstArtistMatch.area.id;
    const countryCode = await fetchCountryCode(areaId);

    setValue(artistName, countryCode);

    makeSongJudgement(element, artistName, countryCode);

    await sleep(1000);

    sleep(1000);
};

let isPolicing = false;
async function policeElements() {
    if (isPolicing) {
        return;
    }

    isPolicing = true;

    let items = document.querySelectorAll('ytmusic-responsive-list-item-renderer');

    for (let i = 0; i < items.length; i++) {
        let item = items[i];

        await policeSongElement(item);
    }

    isPolicing = false;
}

function dislikeSong(element) {
    const dislikeButtonShape = element.querySelector('#button-shape-dislike');
    const dislikeButton = dislikeButtonShape.querySelector('button');
    const isPressed = dislikeButtonShape.getAttribute("aria-pressed") === 'true';
    
    if (isPressed) {
        return;
    }
    
    dislikeButton.click();
}


async function main() {
    setInterval(policeElements, 5000);
}

main();
