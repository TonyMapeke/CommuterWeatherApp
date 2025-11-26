from flask import Flask, render_template, request, jsonify
import requests
import os

app = Flask(__name__)

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/get-google-key')
def get_google_key():
    return jsonify({'key': GOOGLE_API_KEY})

@app.route('/api/route-weather', methods=['POST'])
def get_route_weather():
    try:
        data = request.json
        origin = data.get('origin')
        destination = data.get('destination')
        mode = data.get('mode', 'driving')
        
        if not origin or not destination:
            return jsonify({'error': 'Origin and destination are required'}), 400
        
        if mode not in ['driving', 'transit', 'walking', 'bicycling']:
            return jsonify({'error': 'Invalid travel mode'}), 400
        
        if not GOOGLE_API_KEY:
            return jsonify({'error': 'Missing Key'}), 500
        
        if not OPENWEATHER_API_KEY:
            return jsonify({'error': 'Missing Key'}), 500
        
        directions_url = 'https://maps.googleapis.com/maps/api/directions/json'
        directions_params = {
            'origin': origin,
            'destination': destination,
            'key': GOOGLE_API_KEY,
            'mode': mode
        }
        
        directions_response = requests.get(directions_url, params=directions_params)
        directions_data = directions_response.json()
        
        if directions_data.get('status') != 'OK':
            error_message = directions_data.get('error_message', 'Unable to find route')
            return jsonify({'error': error_message}), 400
        
        route = directions_data['routes'][0]
        leg = route['legs'][0]
        
        end_location = leg['end_location']
        
        weather_url = 'https://api.openweathermap.org/data/2.5/weather'
        weather_params = {
            'lat': end_location['lat'],
            'lon': end_location['lng'],
            'appid': OPENWEATHER_API_KEY,
            'units': 'imperial'
        }
        
        weather_response = requests.get(weather_url, params=weather_params)
        weather_data = weather_response.json()
        
        if weather_response.status_code != 200:
            error_msg = weather_data.get('message', 'Unable to fetch weather data')
            return jsonify({'error': f'Weather API error: {error_msg}'}), 400
        
        route_info = {
            'distance': leg['distance']['text'],
            'duration': leg['duration']['text'],
            'start_address': leg['start_address'],
            'end_address': leg['end_address'],
            'overview_polyline': route['overview_polyline']['points'],
            'mode': mode
        }
        
        if mode == 'transit':
            transit_info = []
            
            def extract_transit_details(steps):
                for step in steps:
                    if 'transit_details' in step:
                        transit = step['transit_details']
                        transit_info.append({
                            'line': transit['line']['short_name'] if 'short_name' in transit['line'] else transit['line']['name'],
                            'vehicle': transit['line']['vehicle']['name'],
                            'departure': transit['departure_stop']['name'],
                            'arrival': transit['arrival_stop']['name'],
                            'num_stops': transit['num_stops']
                        })
                    if 'steps' in step:
                        extract_transit_details(step['steps'])
            
            extract_transit_details(leg.get('steps', []))
            
            if transit_info:
                route_info['transit_details'] = transit_info
        
        result = {
            'route': route_info,
            'weather': {
                'temperature': round(weather_data['main']['temp']),
                'feels_like': round(weather_data['main']['feels_like']),
                'description': weather_data['weather'][0]['description'].title(),
                'icon': weather_data['weather'][0]['icon'],
                'humidity': weather_data['main']['humidity'],
                'wind_speed': round(weather_data['wind']['speed'])
            }
        }
        
        return jsonify(result)
    
    except requests.exceptions.RequestException as e:
        return jsonify({'error': f'API request failed: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': f'Server error: {str(e)}'}), 500

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)
