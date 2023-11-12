let notification_username_element = document.querySelector(
	'.notServiceConf #username'
);
let notification_password_element = document.querySelector(
	'.notServiceConf #password'
);
let notification_port_checkbox = document.querySelector(
	'.notServiceConf #port-enabled'
);
let notification_port_input = document.querySelector('.notServiceConf #port');
let configure_esp_device_dialog = document.querySelector(
	'dialog.configure-esp-device'
);

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
	const to = configure_esp_device_dialog.querySelector('#to');
	const subject = configure_esp_device_dialog.querySelector('#subject');
	const body = configure_esp_device_dialog.querySelector('#body');

	// Setting to already existing values
	id.value = device.id;
	boxNumber.value = device.boxNumber;
	to.value = device.subscriber?.join('; ') ?? '';
	subject.value = device.notificationTitle;
	body.value = device.notificationBody;

	// Showing the dialog
	configure_esp_device_dialog.showModal();
}
