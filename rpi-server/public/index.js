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

notification_username_element.addEventListener('change', () => {
	notification_password_element.disabled = false;
});

notification_port_input.disabled = !notification_port_checkbox.checked;
notification_port_checkbox.addEventListener('change', () => {
	console.log(notification_port_checkbox.checked);
	notification_port_input.disabled = !notification_port_checkbox.checked;

	if (!notification_port_checkbox.checked) {
		notification_port_input.value = DEFAULT_SMTP_PORT;
	}
});
