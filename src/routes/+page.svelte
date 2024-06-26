
  
  <script>
  import { onMount, tick } from 'svelte';
  import html2canvas from 'html2canvas';
  import Map from '$lib/components/Map.svelte';
  import mapDataJson from '$lib/data/map.json';
  import { levenshteinDistance } from '$lib/utils/levenshtein';

  let city = '';
  let matchedCities = [];
  let matchedNisCodes = [];
  let showFoundMessage = false;
  let showNotFoundMessage = false;
  let showAlreadyFoundMessage = false;
  let showCityArrow = false;
  let showCounterAnimation = false;

  const TOTAL_CITIES = 581;
  const initialCountdown = 150;
  let countdown = initialCountdown;
  let timer;
  let gameStarted = false;
  let gameEnded = false;
  let mapScreenshot = '';
  let hardMode = false;
  let gameType = '';
  let totalPopulation = 0;
  let totalSurface = 0;
  let circumference = 2 * Math.PI * 45;

  async function startCountdown() {
    timer = setInterval(() => {
      countdown--;
      updateCircle();
      if (countdown === 0) {
        clearInterval(timer);
        endGame();
      }
    }, 1000);
  }

  async function updateCircle() {
    await tick();
    const circleProgress = document.querySelector('.circle-progress');
    if (circleProgress) {
      const offset = circumference - (countdown / initialCountdown) * circumference;
      circleProgress.style.strokeDashoffset = offset;
    }
  }

  async function captureMapScreenshot() {
    const mapElement = document.querySelector('.map');
    const canvas = await html2canvas(mapElement, { width: window.innerWidth });
    mapScreenshot = canvas.toDataURL('image/png');
  }

  async function endGame() {
    await captureMapScreenshot();
    gameEnded = true;
    gameStarted = false;
    await updateScores();
    await updateGamesPlayed();
  }

  async function updateGamesPlayed() {
    const filePath = 'games_played.csv';
    const header = `mode,datetime\n`;
    const content = `${gameType},${new Date().toISOString()}\n`;
    await appendToFile(filePath, header, content);
  }

  async function updateScores() {
    const filePath = 'scores.csv';
    const header = `mode,score,datetime\n`;
    const content = `${gameType},${matchedCities.length},${new Date().toISOString()}\n`;
    await appendToFile(filePath, header, content);
  }

  async function appendToFile(filePath, header, content) {
    try {
      const response = await fetch('/api/github.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath, header, content }),
      });

      if (!response.ok) {
        throw new Error('Failed to update file');
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error appending to file:', error);
    }
  }
  
    function handleInput(event) {
        city = event.target.value;
    }
  
    function handleSubmit() {
        const lowerCaseCity = city.toLowerCase();
        const topoObjectKey = Object.keys(mapDataJson.objects)[0];
        let cityData;
  
        if (!hardMode) {
            cityData = mapDataJson.objects[topoObjectKey]?.geometries.filter(
                (geo) => geo.properties.name_fr.toLowerCase() === lowerCaseCity ||
                         geo.properties.name_nl.toLowerCase() === lowerCaseCity
            );
  
            if (!cityData || cityData.length === 0) {
                cityData = mapDataJson.objects[topoObjectKey]?.geometries.filter(
                    (geo) => isCityMatchEasy(geo.properties.name_fr.toLowerCase(), lowerCaseCity) ||
                             isCityMatchEasy(geo.properties.name_nl.toLowerCase(), lowerCaseCity)
                );
            }
        } else {
            cityData = mapDataJson.objects[topoObjectKey]?.geometries.filter(
                (geo) => geo.properties.name_fr.toLowerCase() === lowerCaseCity ||
                         geo.properties.name_nl.toLowerCase() === lowerCaseCity
            );
        }
  
        cityData = cityData?.filter(geo => !matchedNisCodes.includes(geo.properties.nis));
  
        if (cityData && cityData.length > 0) {
            const geo = cityData[0];
            const matchedCityNameFr = geo.properties.name_fr.toLowerCase();
            const matchedCityNameNl = geo.properties.name_nl.toLowerCase();
            matchedNisCodes.push(geo.properties.nis);
  
            if (!matchedCities.some(c => c.nis === geo.properties.nis)) {
                matchedCities = [...matchedCities, { nis: geo.properties.nis, originalName: geo.properties.name_fr, lowerCaseName: matchedCityNameFr }];
                totalPopulation += geo.properties.Population_2024;
                totalSurface += geo.properties.Surface;
  
                showCityArrow = true;
                showCounterAnimation = true;
                setTimeout(() => {
                    showCityArrow = false;
                }, 1000);
  
                setTimeout(() => {
                    showCounterAnimation = false;
                }, 500);
  
                city = '';
                showFoundMessage = true;
                showNotFoundMessage = false;
                showAlreadyFoundMessage = false;
                setTimeout(() => showFoundMessage = false, 2000);
            } else {
                showAlreadyFoundMessage = true;
                showFoundMessage = false;
                showNotFoundMessage = false;
                setTimeout(() => showAlreadyFoundMessage = false, 2000);
                city = '';
            }
        } else {
            showNotFoundMessage = true;
            showFoundMessage = false;
            showAlreadyFoundMessage = false;
            setTimeout(() => showNotFoundMessage = false, 2000);
            city = '';
        }
    }
  
    function isCityMatchEasy(city, input) {
        const distance = levenshteinDistance(city, input);
        const partialMatch = city.startsWith(input);
        return distance <= 1 || partialMatch;
    }
  
    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            handleSubmit();
        }
    }
  
    async function startGame(selectedGameType) {
        gameType = selectedGameType;
        gameStarted = true;
        gameEnded = false;
        countdown = initialCountdown;
        matchedCities = [];
        matchedNisCodes = [];
        totalPopulation = 0;
        totalSurface = 0;
  
        await updateGamesPlayed();
  
        if (gameType === 'chrono') {
            startCountdown();
            updateCircle();
        }
    }
  
    function backToMenu() {
        gameStarted = false;
        gameEnded = false;
        clearInterval(timer);
    }
  
    function shareOnNetwork(network) {
        const message = `J'ai trouvé ${matchedCities.length} communes sur 581 au Geogame. Faites le test à votre tour sur example.com`;
        const encodedMessage = encodeURIComponent(message);
        let url = '';
  
        switch (network) {
            case 'twitter':
                url = `https://twitter.com/intent/tweet?text=${encodedMessage}`;
                break;
            case 'facebook':
                url = `https://www.facebook.com/sharer/sharer.php?u=example.com&quote=${encodedMessage}`;
                break;
            case 'linkedin':
                url = `https://www.linkedin.com/shareArticle?mini=true&url=example.com&title=Geogame&summary=${encodedMessage}`;
                break;
            case 'whatsapp':
                url = `https://api.whatsapp.com/send?text=${encodedMessage}`;
                break;
            default:
                return;
        }
        window.open(url, '_blank');
    }
  
    onMount(async () => {
        await tick();
        updateCircle();
    });
  
    $: strokeDashoffsetCounter = (matchedCities.length / TOTAL_CITIES) * circumference;
  </script>
  
<main class="container {gameStarted && !gameEnded ? 'no-background' : ''}">
    {#if !gameStarted && !gameEnded}
        <div class="start-container">
            <div class="overlay"></div>
            <div class="content">
                <div class="toggle-container">
                    <p class="lorem-text"><big><strong>But du jeu : citer un maximum de communes belges en les indiquant dans le champ de recherche au-dessus de la carte</strong></big></p>
                    <p class="lorem-text">Inscrivez une commune et tapez sur "enter" pour la valider</p>
                    <hr class="styled-hr">
                    <p class="lorem-text"><big><strong>Choisissez un niveau de difficulté</strong></big></p>
                    <p class="lorem-text">Si vous activez le "hard mode", vous devez encoder l'orthographe exacte d'une commune pour la valider.</p>
                    <span class="toggle-label">{hardMode ? 'Hard Mode Activé' : 'Hard Mode Désactivé'}</span>
                    <label class="switch">
                        <input type="checkbox" bind:checked="{hardMode}">
                        <span class="slider"></span>
                    </label>
                    <hr class="styled-hr">
                </div>
                <p class="lorem-text"><big><strong>Choisissez un mode de jeu</strong></big></p>
                <p class="lorem-text">Contre la montre: temps limité pour encoder un max de communes. Mode libre : sans limite de temps.</p>
                <div class="mode-buttons">
                    <button on:click="{() => startGame('chrono')}" class="start-button">Contre la Montre</button>
                    <button on:click="{() => startGame('sansChrono')}" class="start-button">Mode libre</button>
                </div>
            </div>
        </div>
    {:else if gameEnded}
        <div class="end-container">
            <div class="end-content">
                <p>C'est fini ! vous avez trouvé {matchedCities.length} communes.</p>
                <p>Où vivent au total {totalPopulation.toLocaleString()} Belges</p>
                <p>Et ce qui représente une surface totale de {totalSurface.toLocaleString()} km²</p>
                {#if mapScreenshot}
                    <img src="{mapScreenshot}" alt="Map Screenshot" class="map-screenshot"/>
                {/if}
                <p>Partagez votre score et défiez vos amis</p>
                <div class="social-buttons">
                    <button on:click={() => shareOnNetwork('twitter')} class="social-button twitter">Twitter</button>
                    <button on:click={() => shareOnNetwork('facebook')} class="social-button facebook">Facebook</button>
                    <button on:click={() => shareOnNetwork('linkedin')} class="social-button linkedin">LinkedIn</button>
                    <button on:click={() => shareOnNetwork('whatsapp')} class="social-button whatsapp">WhatsApp</button>
                </div>
                <button on:click="{backToMenu}" class="restart-button">Retour au menu</button>
                <button on:click="{() => startGame(gameType)}" class="restart-button">Rejouer</button>
            </div>
        </div>
    {:else}
        <div class="game-view">
            <div class="controls">
                <div class="input-container">
                    <input
                        type="text"
                        placeholder="Encodez une ville + enter"
                        bind:value="{city}"
                        on:input="{handleInput}"
                        on:keypress="{handleKeyPress}"
                        class="input-field"
                    />
                </div>
                <button on:click="{backToMenu}" class="back-button">Retour au menu</button>
            </div>
            <div class="status-container">
                <div class="score-container">
                    <div class="counter-container {showCounterAnimation ? 'animate' : ''}">
                        <div class="counter-header">Score</div>
                        <svg width="60" height="60" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" class="counter-circle" fill="white"></circle>
                            <circle cx="50" cy="50" r="45" stroke="green" stroke-width="5" fill="none" style="stroke-dasharray: {circumference}; stroke-dashoffset: {circumference - strokeDashoffsetCounter}; transform: rotate(-90deg); transform-origin: 50% 50%;"></circle>
                            <text x="50" y="55" text-anchor="middle" font-size="20" fill="black">{matchedCities.length}</text>
                        </svg>
                    </div>
                </div>
                <div class="timer-share-container">
                    {#if gameType === 'chrono'}
                        <div class="timer-container">
                            <div class="timer-header">Temps restant</div>
                            <svg width="60" height="60" viewBox="0 0 100 100" class="timer-circle">
                                <circle cx="50" cy="50" r="45" stroke="#ddd" stroke-width="5" fill="none"></circle>
                                <circle cx="50" cy="50" r="45" stroke="blue" stroke-width="5" fill="none" class="circle-progress" style="stroke-dasharray: {circumference}; stroke-dashoffset: 0;"></circle>
                                <text x="50" y="55" text-anchor="middle" font-size="20" fill="black">{countdown}</text>
                            </svg>
                        </div>
                    {:else}
                        <button on:click="{endGame}" class="share-button">Partager mon score</button>
                    {/if}
                </div>
            </div>

            {#if showFoundMessage}
                <div class="found-message">+1 !</div>
            {/if}
            {#if showNotFoundMessage}
                <div class="not-found-message">Pas trouvé</div>
            {/if}
            {#if showAlreadyFoundMessage}
                <div class="already-found-message">Déjà cité!</div>
            {/if}

            <div class="map-container">
                <div class="map">
                    <Map {matchedCities} />
                </div>
                <div class="found-cities">
                    <h3>Villes trouvées:</h3>
                    <ul>
                        {#each matchedCities as matchedCity}
                            <li>{matchedCity.originalName}</li>
                        {/each}
                    </ul>
                </div>
            </div>
        </div>
    {/if}
</main>

<style>
    *{
        font-family: "Montserrat", sans-serif;
    }
    .container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 16px;
        position: relative;
        height: 100vh;
        background: url('../back2.webp') no-repeat center center fixed;
        background-size: cover;
    }
    
    .no-background {
        background: none;
    }
    
    .overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7); 
        z-index: 1;
    }
    
    .content {
        position: relative;
        z-index: 2;
        width: 100%;
        text-align: center;
        color: white;
    }

    .styled-hr {
        border: 0;
        height: 2px;
        background: linear-gradient(to right, #f06, #4a90e2);
        margin: 16px 0;
        width: 150px;
    }
    
    .game-view {
        width: 100%;
        position: relative;
    }
    
    .controls {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px; 
    }
    
    .input-container {
        display: flex;
        flex-grow: 1;
        margin-right: 16px; 
    }
    
    .input-field {
        width: 100%;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
        height: 42px; 
    }
    
    .input-field::placeholder {
        font-size: 14px; 
    }
    
    .back-button {
        padding: 8px 16px;
        background-color: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        height: 42px; 
        display: flex;
        align-items: center; 
        justify-content: center; 
    }
    
    .status-container {
        width: 100%;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 16px; 
    }
    
    .score-container {
        display: flex;
        justify-content: flex-start;
        align-items: center;
    }
    
    .timer-share-container {
        display: flex;
        justify-content: flex-end;
        align-items: center;
    }
    
    .counter-container, .timer-container {
        text-align: center;
    }
    
    .counter-header, .timer-header {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 8px;
    }
    
    .counter-container.animate .counter-circle {
        stroke: green;
        animation: color-change 0.5s ease-in-out;
    }
    
    @keyframes color-change {
        0% {
            fill: green;
        }
        100% {
            fill: white;
        }
    }
    
    .timer-circle {
        position: relative;
    }
    
    .circle-progress {
        transform: rotate(-90deg);
        transform-origin: 50% 50%;
        transition: stroke-dashoffset 1s linear;
    }
    
    .map-container {
        width: 100%;
        position: relative; 
    }
    
    .map {
        width: 100%;
        position: relative;
    }
    
    .found-message, .not-found-message, .already-found-message {
        position: fixed;
        top: 30%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(255, 255, 255, 0.8);
        padding: 16px;
        border-radius: 8px;
        font-size: 24px;
        animation: pop-up 1s ease-in-out;
        z-index: 3;
    }
    
    .found-message {
        color: #28a745;
    }
    
    .not-found-message {
        color: #dc3545;
    }
    
    .already-found-message {
        color: #ffc107;
    }
    
    @keyframes pop-up {
        0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        50% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
    }
    
    .found-cities {
        margin-left: 16px;
    }
    
    .found-cities h3 {
        margin: 0 0 8px 0;
    }
    
    .found-cities ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
    }
    
    .found-cities li {
        background-color: #f0f0f0;
        padding: 4px 8px;
        margin-bottom: 4px;
        border-radius: 4px;
    }
    
    .start-container, .end-container {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        height: 100vh;
        text-align: center; 
        padding: 16px;
    }
    
    .end-container {
        background-color: rgba(0, 0, 0, 0.7); 
        color: white; 
        padding: 20px;
        border-radius: 10px;
        width: 100%;
        max-width: 600px;
    }
    
    .social-buttons {
        display: flex;
        justify-content: center;
        margin-top: 20px;
        flex-wrap: wrap;
    }
    
    .social-button {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 16px;
        margin: 5px 10px;
        padding: 10px;
        color: white;
        border-radius: 5px; 
    }
    
    .social-button.twitter {
        background-color: #1da1f2;
    }
    
    .social-button.facebook {
        background-color: #3b5998;
    }
    
    .social-button.linkedin {
        background-color: #0077b5;
    }
    
    .social-button.whatsapp {
        background-color: #25d366;
    }
    
    .start-button, .restart-button, .share-button {
        padding: 12px 24px;
        background-color: #28a745;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 18px;
        cursor: pointer;
        margin: 8px;
    }
    
    .start-button:hover, .restart-button:hover, .share-button:hover {
        background-color: #218838;
    }
    
    .toggle-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 16px;
    }
    
    .switch {
        position: relative;
        display: inline-block;
        width: 60px;
        height: 34px;
        margin-bottom: 8px;
        margin-top: 16px;
    }
    
    .switch input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    .slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #ccc;
        transition: .4s;
        border-radius: 34px;
    }
    
    .slider:before {
        position: absolute;
        content: "";
        height: 26px;
        width: 26px;
        left: 4px;
        bottom: 4px;
        background-color: white;
        transition: .4s;
        border-radius: 50%;
    }
    
    input:checked + .slider {
        background-color: #2196F3;
    }
    
    input:checked + .slider:before {
        transform: translateX(26px);
    }
    
    .toggle-label {
        margin-top: 8px;
    }
    
    .lorem-text {
        margin-bottom: 8px;
        text-align: center;
    }
    
    .map-screenshot {
        margin-top: 16px;
        border: 2px solid #ccc;
        border-radius: 8px;
        width: 100%;
    }
    
    @media (max-width: 767px) {
        
        .lorem-text {

        font-size: 12px;
    }
        .input-field {
            width: 100%;
        }
        .social-buttons {
            flex-direction: column; 
        }
        .input-field::placeholder {
            font-size: 12px; 
        }
        .input-field {
            padding: 6px; 
            font-size: 12px; 
        }
    }
    
    @media (min-width: 768px) {
        .controls {
            width: 100%;
        }
        .input-field {
            width: 100%;
        }
    }
</style>

