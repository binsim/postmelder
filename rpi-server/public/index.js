let notification_username_element = document.querySelector(
	'.notServiceConf #username'
);
let notification_password_element = document.querySelector(
	'.notServiceConf #password'
);

notification_username_element.addEventListener('change', () => {
	notification_password_element.disabled = false;
});
