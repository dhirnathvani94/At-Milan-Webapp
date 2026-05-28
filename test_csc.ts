import { State, City } from 'country-state-city';
console.log(State.getStatesOfCountry('IN').slice(0, 5));
console.log(City.getCitiesOfState('IN', 'GJ').slice(0, 10));
