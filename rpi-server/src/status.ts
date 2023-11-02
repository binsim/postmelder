import { init, open, write, OUTPUT, LOW, HIGH } from 'rpio';

const R_PIN = 1;
const G_PIN = 1;
const B_PIN = 1;

init({ close_on_exit: true, mapping: 'gpio' });

open(R_PIN, OUTPUT, LOW);
open(G_PIN, OUTPUT, LOW);
open(B_PIN, OUTPUT, LOW);

type State =
	| 'ok'
	| 'externalNetworkError'
	| 'internalNetworkError'
	| 'undefined';

let currentState: State;
export function setState(state: State) {
	if (currentState === state) return;

	// Uncomment if only one state can be shown
	// write(R_PIN, LOW);
	// write(G_PIN, LOW);
	// write(B_PIN, LOW);

	switch (state) {
		case 'ok':
			write(G_PIN, HIGH);
			write(R_PIN, LOW);
			write(B_PIN, LOW);
			break;
		case 'internalNetworkError':
			write(B_PIN, HIGH);
			write(G_PIN, LOW);
			break;
		case 'externalNetworkError':
			write(R_PIN, HIGH);
			write(G_PIN, LOW);
	}
}
