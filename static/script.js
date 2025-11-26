let map;
let directionsRenderer;
let selectedMode = 'driving';
let hasSearched = false;

const GOOGLE_API_KEY = 'REPLACE_WITH_YOUR_API_KEY';

document.getElementById('searchBtn').addEventListener('click', searchRoute);

document.getElementById('origin').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchRoute();
});

document.getElementById('destination').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') searchRoute();
});

const modeButtons = document.querySelectorAll('.mode-btn');
modeButtons.forEach(button => {
    button.addEventListener('click', function() {
        modeButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        selectedMode = this.dataset.mode;
        
        if (hasSearched) {
            searchRoute();
        }
    });
});

function initMap() {
    const defaultCenter = { lat: 40.7128, lng: -74.0060 };
    
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 7,
        center: defaultCenter,
        styles: [
            {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#a2daf2' }]
            },
            {
                featureType: 'landscape',
                elementType: 'geometry',
                stylers: [{ color: '#f5f5f5' }]
            }
        ]
    });
    
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        suppressMarkers: false,
        polylineOptions: {
            strokeColor: '#667eea',
            strokeWeight: 5
        }
    });
}

async function searchRoute() {
    const origin = document.getElementById('origin').value.trim();
    const destination = document.getElementById('destination').value.trim();
    const searchBtn = document.getElementById('searchBtn');
    
    if (!origin || !destination) {
        showError('Please enter both starting location and destination');
        return;
    }
    
    searchBtn.classList.add('loading');
    showLoading();
    hideError();
    hideResults();
    
    try {
        const response = await fetch('/api/route-weather', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ origin, destination, mode: selectedMode })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch route and weather data');
        }
        
        displayResults(data);
        displayMap(data.route);
        hasSearched = true;
        
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoading();
        searchBtn.classList.remove('loading');
    }
}

function displayResults(data) {
    document.getElementById('startAddress').textContent = data.route.start_address;
    document.getElementById('endAddress').textContent = data.route.end_address;
    document.getElementById('distance').textContent = data.route.distance;
    document.getElementById('duration').textContent = data.route.duration;
    
    const transitDetails = document.getElementById('transitDetails');
    if (data.route.transit_details && data.route.transit_details.length > 0) {
        let transitHTML = '<h3>🚇 Transit Details</h3>';
        data.route.transit_details.forEach(transit => {
            transitHTML += `
                <div class="transit-step">
                    <div class="transit-line">${transit.vehicle}: ${transit.line}</div>
                    <div class="transit-info">
                        ${transit.departure} → ${transit.arrival}
                        <br>${transit.num_stops} stops
                    </div>
                </div>
            `;
        });
        transitDetails.innerHTML = transitHTML;
        transitDetails.classList.remove('hidden');
    } else {
        transitDetails.classList.add('hidden');
    }
    
    document.getElementById('temperature').textContent = data.weather.temperature;
    document.getElementById('feelsLike').textContent = data.weather.feels_like;
    document.getElementById('weatherDescription').textContent = data.weather.description;
    document.getElementById('humidity').textContent = data.weather.humidity;
    document.getElementById('windSpeed').textContent = data.weather.wind_speed;
    
    const iconUrl = `https://openweathermap.org/img/wn/${data.weather.icon}@2x.png`;
    document.getElementById('weatherIcon').src = iconUrl;
    document.getElementById('weatherIcon').alt = data.weather.description;
    
    showResults();
}

function displayMap(routeData) {
    if (!map) {
        initMap();
    }
    
    const directionsService = new google.maps.DirectionsService();
    
    const travelModeMap = {
        'driving': google.maps.TravelMode.DRIVING,
        'transit': google.maps.TravelMode.TRANSIT,
        'walking': google.maps.TravelMode.WALKING,
        'bicycling': google.maps.TravelMode.BICYCLING
    };
    
    const request = {
        origin: routeData.start_address,
        destination: routeData.end_address,
        travelMode: travelModeMap[routeData.mode] || google.maps.TravelMode.DRIVING
    };
    
    directionsService.route(request, function(result, status) {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
        } else {
            console.error('Directions request failed:', status);
        }
    });
}

function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function showResults() {
    document.getElementById('results').classList.remove('hidden');
}

function hideResults() {
    document.getElementById('results').classList.add('hidden');
}

function loadGoogleMapsScript() {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&callback=initMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
}

window.addEventListener('load', function() {
    fetch('/api/get-google-key')
        .then(response => response.json())
        .then(data => {
            if (data.key) {
                const script = document.createElement('script');
                script.src = `https://maps.googleapis.com/maps/api/js?key=${data.key}&callback=initMap`;
                script.async = true;
                script.defer = true;
                document.head.appendChild(script);
            } else {
                console.error('Google API key not available');
            }
        })
        .catch(error => {
            console.error('Error loading Google Maps API key:', error);
        });
});
