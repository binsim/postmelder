//#region Define element variables
const notification_conf_dialog = document.querySelector(
	'dialog.notServiceConf'
);
const notification_username_element =
	notification_conf_dialog.querySelector('#username');
const notification_password_element =
	notification_conf_dialog.querySelector('#password');
const notification_port_checkbox =
	notification_conf_dialog.querySelector('#port-enabled');
const notification_port_input = notification_conf_dialog.querySelector('#port');
const notification_conf_dialog_show_button = document.querySelector(
	'#show-notification-service-conf-dialog'
);

const configure_esp_device_dialog = document.querySelector(
	'dialog.configure-esp-device'
);
const testmessage_response_dialog = document.querySelector(
	'dialog.testmessage-response'
);
const testmessage_response_dialog_close_btn =
	testmessage_response_dialog.querySelector('button#close');

const box_details_dialog = document.querySelector('dialog.box-details');
const box_details_dialog_close_btn =
	box_details_dialog.querySelector('button#close');

const calibrate_dialog = document.querySelector('dialog.calibrate');
const calibrate_cancel_btn = calibrate_dialog.querySelector('button.cancel');
const calibrate_stages = calibrate_dialog.querySelectorAll('section.stage');
const calibrate_prev_button = calibrate_dialog.querySelector('button.prev');
const calibrate_next_button = calibrate_dialog.querySelector('button.next');
//#endregion Define element variables

//#region DOM event listener
box_details_dialog_close_btn.addEventListener('click', () => {
	box_details_dialog.close();
});

testmessage_response_dialog_close_btn.addEventListener('click', (e) => {
	testmessage_response_dialog.close();
});

notification_username_element.addEventListener('change', () => {
	notification_password_element.disabled = false;
});
notification_conf_dialog_show_button.addEventListener('click', () => {
	notification_conf_dialog.showModal();
});

notification_port_input.disabled = !notification_port_checkbox.checked;
notification_port_checkbox.addEventListener('change', () => {
	notification_port_input.disabled = !notification_port_checkbox.checked;

	if (!notification_port_checkbox.checked) {
		notification_port_input.value = DEFAULT_SMTP_PORT;
	}
});
calibrate_cancel_btn.addEventListener('click', async (e) => {
	// Prevent form to be submitted
	e.preventDefault();

	// Close dialog
	calibrate_dialog.close();
	// Send abort to esp-client
	const response = await fetch(
		`/calibrate/${current_calibrate_device}/cancel`,
		{
			method: 'POST',
		}
	);

	// Reset saved values
	current_calibrate_device = undefined;
	current_calibrate_stage = 0;
	current_calibrate_url = undefined;

	// Check if successfully aborted
	if (response.status !== 200) {
		alert(await response.text());
	}

	// Nothing must be done
});
calibrate_prev_button.addEventListener('click', (e) => {
	// Prevent form to be submitted
	e.preventDefault();

	// Return to previous stage
	calibrate_stage_changed(-1);
});
calibrate_next_button.addEventListener('click', async (e) => {
	// Prevent form to be submitted
	e.preventDefault();

	let response;
	switch (current_calibrate_stage) {
		case 0:
			// Make fetch request to execute calibrate on esp-device
			response = await fetch(current_calibrate_url, {
				method: 'POST',
			});

			// Check if execution was successful
			if (response.status != 200) {
				// Notify user for this error
				alert(await response.text());
				return;
			}
			// Get data from response and write it to hidden input
			const scaleOffset = Number((await response.json()).scaleOffset);
			if (isNaN(scaleOffset)) {
				alert('Response invalid');
				return;
			}
			const scaleOffset_input =
				calibrate_dialog.querySelector('input#scale-offset');
			if (scaleOffset_input === undefined) {
				alert('Unexpected error');
				return;
			}
			scaleOffset_input.value = scaleOffset;
			break;
		case 1:
			// Make fetch request to execute calibration with specified weight
			response = await fetch(current_calibrate_url, {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					weight: calibrate_dialog.querySelector('input#weight')
						.value,
				}),
			});
			// Check if execution was successful
			if (response.status != 200) {
				// Notify user for this error
				alert(await response.text());
				return;
			}

			// Get data from response and write to hidden input
			const scaleValue = Number((await response.json()).scaleValue);
			if (isNaN(scaleValue)) {
				alert('Response invalid');
				return;
			}
			const scaleValue_input =
				calibrate_dialog.querySelector('input#scale-value');
			if (scaleValue_input === undefined) {
				alert('Unexpected error');
				return;
			}
			scaleValue_input.value = scaleValue;
			break;
	}
	calibrate_stage_changed(+1);
});
//#endregion DOM event listener

function configureDevice(device) {
	// Getting all elements
	const id = configure_esp_device_dialog.querySelector('#id');
	const boxNumber = configure_esp_device_dialog.querySelector('#boxNumber');
	const checkInterval =
		configure_esp_device_dialog.querySelector('#checkInterval');
	const to = configure_esp_device_dialog.querySelector('#to');
	const subject = configure_esp_device_dialog.querySelector('#subject');
	const body = configure_esp_device_dialog.querySelector('#body');

	// Setting to already existing values
	id.value = device.id;
	boxNumber.value = device.boxNumber;
	checkInterval.value = device.checkInterval;
	to.value = device.subscriber?.join('; ') ?? '';
	subject.value = device.notificationTitle ?? '';
	body.value = device.notificationBody ?? '';

	// Showing the dialog
	configure_esp_device_dialog.showModal();
}

async function testMessage(e, deviceId) {
	e.stopPropagation();
	testmessage_response_dialog.showModal();

	// Getting all elements
	const accepted_destinations_ul = testmessage_response_dialog.querySelector(
		'.accepted-destinations ul'
	);
	const rejected_destinations_ul = testmessage_response_dialog.querySelector(
		'.rejected-destinations ul'
	);
	const loader = testmessage_response_dialog.querySelector('.loader-wrapper');

	// Show loader
	loader.style.display = 'block';

	// Clear elements
	accepted_destinations_ul.innerHTML = '';
	rejected_destinations_ul.innerHTML = '';

	// Trigger test message sending and get response
	const response = await (await fetch('/testMessage?id=' + deviceId)).json();

	// Remove loader
	loader.style.display = 'none';

	// Visualize response
	if (response.accepted) {
		response.accepted.forEach((e) => {
			const i = document.createElement('li');
			i.innerText = e;
			accepted_destinations_ul.appendChild(i);
		});
	}
	if (response.rejected) {
		response.rejected.forEach((e) => {
			const i = document.createElement('li');
			i.innerText = e;
			rejected_destinations_ul.appendChild(i);
		});
	}
}

let history_h2_default_text = undefined;
async function boxDetails(e, deviceId) {
	e.stopPropagation();

	// Getting all elements
	const last_emptied_p = box_details_dialog.querySelector('p');
	const history_h2 = box_details_dialog.querySelectorAll('h2')[1];
	const history_ul = box_details_dialog.querySelector('ul');

	// Initialize default text or reset to it
	if (history_h2_default_text === undefined) {
		history_h2_default_text = history_h2.innerText;
	} else {
		history_h2.innerText = history_h2_default_text;
	}

	// Show dialog
	box_details_dialog.showModal();

	// Get box details
	const response = await (await fetch('/boxDetails?id=' + deviceId)).json();

	// Visualize last emptied
	last_emptied_p.innerText = new Date(response.lastEmptied).toLocaleString();

	// Visualize history
	if (response.history.length > 0) {
		// Show history with weight and date
		response.history.forEach((i) => {
			const li = document.createElement('li');
			li.innerHTML = `<span class="weight">${
				i.weight
			} g</span> erkannt am <span class="time">${new Date(
				i.timeStamp
			).toLocaleString()}</span>`;
			history_ul.appendChild(li);
		});
	} else {
		// Show only that it is currently empty because there is no history
		history_ul.innerHTML = '';
		history_h2.innerText = 'Postfach ist leer';
	}
}

let current_calibrate_device = undefined;
let current_calibrate_stage = 0;
let current_calibrate_url = undefined;
async function calibrateDevice(e, deviceId) {
	e.stopPropagation();

	// Show witch esp-device gets calibrated
	const h1 = calibrate_dialog.querySelector('h1');
	h1.innerText = 'Kalibrieren: ' + deviceId;

	current_calibrate_device = deviceId;
	current_calibrate_stage = 0;

	calibrate_stage_changed(0);

	// Show calibrate dialog
	calibrate_dialog.showModal();
}
function calibrate_stage_changed(stageChange) {
	// update to new calibration stage
	current_calibrate_stage += stageChange;

	// Show new active stage in dialog
	calibrate_stages.forEach((stage, i) => {
		const display = i == current_calibrate_stage ? 'block' : 'none';
		stage.style.display = display;
	});

	// Update html for new stage
	const h2 = calibrate_dialog.querySelector('h2');
	const form = calibrate_dialog.querySelector('form');
	const finish_button = calibrate_dialog.querySelector(
		'form button[type="submit"]'
	);

	// Update ui for new stage
	h2.innerText =
		'Schritt ' +
		((current_calibrate_stage ?? 0) + 1) +
		' von ' +
		calibrate_stages.length;

	calibrate_prev_button.style.visibility =
		current_calibrate_stage > 0 ? 'visible' : 'hidden';
	calibrate_next_button.style.display =
		current_calibrate_stage < calibrate_stages.length - 1
			? 'inline'
			: 'none';
	finish_button.style.display =
		current_calibrate_stage == calibrate_stages.length - 1
			? 'inline'
			: 'none';

	current_calibrate_url = `/calibrate/${current_calibrate_device}/${current_calibrate_stage}`;
	form.action = current_calibrate_url;
}
