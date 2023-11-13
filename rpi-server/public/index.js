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

const configure_esp_device_dialog = document.querySelector(
	'dialog.configure-esp-device'
);
const testmessage_response_dialog = document.querySelector(
	'dialog.testmessage-response'
);
const testmessage_response_dialog_close_btn =
	testmessage_response_dialog.querySelector('button#close');

testmessage_response_dialog_close_btn.addEventListener('click', (e) => {
	testmessage_response_dialog.close();
});

notification_username_element.addEventListener('change', () => {
	notification_password_element.disabled = false;
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
	const boxNumber = configure_esp_device_dialog.querySelector('#boxnumber');
	const checkInterval =
		configure_esp_device_dialog.querySelector('#checkinterval');
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

function showNotificationServiceConfDialog() {
	notification_conf_dialog.showModal();
}
