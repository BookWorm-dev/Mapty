'use strict';



const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllWorkots = document.querySelector('.delete__all')
const modal = document.querySelector('.modal');
const msg = modal.querySelector('.modal__message');

class Workout {
    date = new Date();
    id = (Date.now() + '').slice(-10);
    clicks = 0;

    constructor(coords, distance, duration) {
        this.coords = coords; //[lat, lng]
        this.distance = distance; //in km
        this.duration = duration; //in min

    }

    _setDescrpition() {

        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;

    }
    click() {
        this.clicks++;
    }
}

class Running extends Workout {
    type = 'running';

    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();
        this._setDescrpition()
    }

    calcPace() {
        // min/km
        this.pace = this.duration / this.distance;
        return this.pace
    }
}
class Cycling extends Workout {
    type = 'cycling';
    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();
        this._setDescrpition()
    }

    calcSpeed() {
        // kn/h
        this.speed = this.distance / this.duration;
        return this.speed;
    }
}

class App {
    #map;
    #mapZoomLevel = 13;
    #mapEvent;
    #workouts = [];
    #editWorkout = null;

    constructor() {
        //get user's position
        this._getPosition();

        //get data from local storage

        this._getLocalStorage();

        //Attach event handlers
        form.addEventListener('submit', this._newWorkout.bind(this));
        inputType.addEventListener('change', this._toggleElevationField);
        containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
        containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));
        containerWorkouts.addEventListener('click', this._addWorkout.bind(this));
        deleteAllWorkots.addEventListener('click', this._deleteAllWorkouts.bind(this));
    }

    _getPosition() {
        if (navigator.geolocation)
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this),
                function () {
                    showModal('⚠️ Inputs must be positive numbers!');
                }
            );
    }

    _loadMap(position) {
        const { latitude, longitude } = position.coords;
        const coords = [latitude, longitude];

        this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.#map);

        //Handling clicks on map
        this.#map.on('click', this._showForm.bind(this));

        this.#workouts.forEach(work => {
            this._renderWorkout(work);
            this._renderWorkoutMarker(work);
        })
        this._showAllWorkouts();
    }
    _showForm(mapE) {
        this.#mapEvent = mapE;
        form.classList.remove('hidden');
        inputDistance.focus();
    }

    _hideForm() {
        //Empty inputs
        inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => form.style.display = 'grid', 1000);
    }

    _toggleElevationField() {
        inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
        inputCadence.closest('.form__row').classList.toggle('form__row--hidden');

    }

    _newWorkout(e) {

        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp >= 0);
        e.preventDefault();

        //get data from form

        const type = inputType.value;
        if (this.#editWorkout) {
            this.#editWorkout.distance = +inputDistance.value;
            this.#editWorkout.duration = +inputDuration.value;

            if (this.#editWorkout.type === 'running') {
                this.#editWorkout.cadence = +inputCadence.value;
                this.#editWorkout.calcPace();
            } else if (this.#editWorkout.type === 'cycling') {
                this.#editWorkout.elevationGain = +inputElevation.value;
                this.#editWorkout.calcSpeed();
            }

            this._setLocalStorage();

            location.reload();

            this.#editWorkout = null;
            this._hideForm();
            return;
        }
        const distance = +inputDistance.value;
        const duration = +inputDuration.value;
        const { lat, lng } = this.#mapEvent.latlng;
        let workout;

        //if workout running, create running object
        if (type === 'running') {
            const cadence = +inputCadence.value;

            //check if data is valid
            if (!validInputs(distance, duration, cadence) ||
                !allPositive(distance, duration, cadence)
            ) {
                showModal('Inputs have to be positive number!')
                return;
            }

            workout = new Running([lat, lng], distance, duration, cadence);
        }
        //if workout cycling, create cycling object 
        if (type === 'cycling') {
            const elevation = +inputElevation.value;

            if (!validInputs(distance, duration, elevation) || !allPositive(distance, duration)
            ) {
                showModal('Inputs have to be positive number!')
                return;
            }

            workout = new Cycling([lat, lng], distance, duration, elevation);

        }
        //add new object to workout array
        this.#workouts.push(workout);

        //render workout on map as marker 
        this._renderWorkoutMarker(workout);

        //render workout on list 
        this._renderWorkout(workout);

        //Hide form + clear input fields

        this._hideForm();

        //Set local storage to all workouts

        this._setLocalStorage();
    }


    _renderWorkoutMarker(workout) {
        const marker = L.marker(workout.coords)
            .addTo(this.#map)
            .bindPopup(L.popup({
                maxWidth: 250,
                minWidth: 200,
                autoClose: false,
                closeOnClick: false,
                className: `${workout.type}-popup`,
            }))
            .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`)
            .openPopup();

        workout.marker = marker;
    }

    _renderWorkout(workout) {
        let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
          <h2 class="workout__title">${workout.description}</h2>
          <button  class="workout__delete">❌ </button >
          <button class="workout__edit">✏️</button>
          <div class="workout__details">
            <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
            }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div >
    <div class="workout__details">
        <span class="workout__icon">⏱</span>
        <span class="workout__value">${workout.duration}</span>
        <span class="workout__unit">min</span>
    </div>`;

        if (workout.type === 'running')
            html += `<div class="workout__details">
                    <span class="workout__icon">⚡️</span>
                    <span class="workout__value">${workout.pace.toFixed(1)}</span>
                    <span class="workout__unit">min/km</span>
                  </div>
                  <div class="workout__details">
                    <span class="workout__icon">🦶🏼</span>
                    <span class="workout__value">${workout.cadence}</span>
                    <span class="workout__unit">spm</span>
                  </div>
                </li>`;
        if (workout.type === 'cycling')
            html += ` <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;

        form.insertAdjacentHTML('afterend', html);

    }

    _moveToPopup(e) {
        const workoutEl = e.target.closest('.workout');

        if (!workoutEl) return;

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);

        this.#map.setView(workout.coords, this.#mapZoomLevel, {
            animate: true,
            pan: {
                duration: 1
            }
        })
        //using the public interface

        // workout.click();
    }
    _setLocalStorage() {
        const cleanWorkouts = this.#workouts.map(w => {
            const obj = { ...w };
            delete obj.marker;
            return obj;
        });

        localStorage.setItem('workouts', JSON.stringify(cleanWorkouts));
    }

    _getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('workouts'));
        if (!data) return;

        this.#workouts = data.map(obj => {
            if (obj.type === 'running') {
                const run = new Running(obj.coords, obj.distance, obj.duration, obj.cadence);
                run.id = obj.id;
                run.date = new Date(obj.date);
                return run;
            }

            if (obj.type === 'cycling') {
                const cyc = new Cycling(obj.coords, obj.distance, obj.duration, obj.elevationGain);
                cyc.id = obj.id;
                cyc.date = new Date(obj.date);
                return cyc;
            }
        });
    }

    reset() {
        localStorage.removeItem('workouts');
        location.reload();
    }
    _deleteWorkout(e) {
        const btn = e.target.closest('.workout__delete');
        if (!btn) return;

        const workoutEl = btn.closest('.workout');
        if (!workoutEl) return;

        const workoutId = workoutEl.dataset.id;
        const workout = this.#workouts.find(w => w.id === workoutId);

        if (workout && workout.marker) workout.marker.remove();

        this.#workouts = this.#workouts.filter(w => w.id !== workoutId);

        workoutEl.remove();

        this._setLocalStorage();
    }
    _addWorkout(e) {
        const btn = e.target.closest('.workout__edit');
        if (!btn) return;

        const workoutEl = btn.closest('.workout');
        if (!workoutEl) return;
        const workoutId = workoutEl.dataset.id;
        const workout = this.#workouts.find(w => w.id === workoutId);

        if (!workout) return;

        this.#editWorkout = workout;
        form.classList.remove('hidden');
        inputDistance.focus();

        inputType.value = workout.type;
        inputDistance.value = workout.distance;
        inputDuration.value = workout.duration;

        if (workout.type === 'running') {
            inputCadence.value = workout.cadence;
            inputElevation.closest('.form__row').classList.add('form__row--hidden');
            inputCadence.closest('.form__row').classList.remove('form__row--hidden');
        }

        if (workout.type === 'cycling') {
            inputElevation.value = workout.elevationGain;
            inputCadence.closest('.form__row').classList.add('form__row--hidden');
            inputElevation.closest('.form__row').classList.remove('form__row--hidden');
        }


    }
    _showAllWorkouts() {
        if (this.#workouts.length === 0) return;

        const bounds = L.latLngBounds(this.#workouts.map(work => work.coords));
        this.#map.fitBounds(bounds, {
            padding: [50, 50] // небольшой отступ от границ
        });
        console.log(this.#workouts);
    }

    _deleteAllWorkouts() {
        this.#workouts.forEach(w => w.marker?.remove());

        this.#workouts = [];

        document.querySelectorAll('.workout').forEach(el => el.remove());

        this._setLocalStorage();
    }

}

const app = new App();
function showModal(message) {
    const modal = document.querySelector('.modal');
    const msg = modal.querySelector('.modal__message');
    msg.textContent = message;
    modal.classList.add('show')
    setTimeout(() => modal.classList.remove('show'), 2500)
}
