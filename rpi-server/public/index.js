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

	const accepted_destinations_ul = testmessage_response_dialog.querySelector(
		'.accepted-destinations ul'
	);
	const rejected_destinations_ul = testmessage_response_dialog.querySelector(
		'.rejected-destinations ul'
	);
	const loader = testmessage_response_dialog.querySelector('.loader-wrapper');

	const response = await (await fetch('/testMessage?id=' + deviceId)).json();

	loader.style.display = 'none';

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

	const last_emptied_p = box_details_dialog.querySelector('p');
	const history_h2 = box_details_dialog.querySelectorAll('h2')[1];
	const history_ul = box_details_dialog.querySelector('ul');

	if (history_h2_default_text === undefined) {
		history_h2_default_text = history_h2.innerText;
	} else {
		history_h2.innerText = history_h2_default_text;
	}

	box_details_dialog.showModal();

	const response = await (await fetch('/boxDetails?id=' + deviceId)).json();

	const last_emptied = new Date(response.lastEmptied);
	last_emptied_p.innerText = last_emptied.toLocaleString();

	if (response.history.length > 0) {
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
		history_ul.innerHTML = '';
		history_h2.innerText = 'Postfach ist leer';
	}
}
