import { Context, Hono } from "hono";
import { setCookie } from "hono/cookie";
import createAdmin from "@src/utils/auth/admin/createAdmin";
import { getCollection } from "@src/utils/getCollection";
import checkAdminExists from "@src/utils/auth/admin/checkAdminExists";
import checkLoginValid from "@src/utils/auth/admin/checkLoginValid";
import deleteAdmin from "@src/utils/auth/admin/deleteAdmin";
import getAdmins from "@src/utils/auth/admin/getAdmins";
import {
	createRecord,
	deleteRecord,
	readRecord,
} from "@src/controllers/record-crud";
import sign from "@src/utils/auth/sign";
import Database from "@src/database/database_handler";
import { OAuth2Client } from "google-auth-library";
import { html } from "hono/html";

const auth = new Hono();

auth.post("/admin/create", async (c: Context) => {
	try {
		const { email, password } = await c.req.json();

		if (!email || !password) throw new Error("Invalid email or password");

		const admin = await createAdmin(email, password);

		if (!admin) throw new Error("Failed to create admin");

		const payload = {
			email,
			role: 'admin',
			authenticated: true,
		}

		const token = await sign(payload, process.env.USER_AUTH_KEY || "user_key");

		console.log(token);

		// setCookie(c, "admin", JSON.stringify(email), {
		// 	httpOnly: true,
		// 	secure: true,
		// 	sameSite: "Strict",
		// 	maxAge: 60 * 60 * 24 * 7,
		// });
		return c.json({ error: null, data: token });
	} catch (error) {
		console.log(error);

		return c.json({ error, data: null });
	}
	return c.text("Create admin");
});

auth.get("/admin", async (c: Context) => {
	try {
		// check if an admin exists
		const admin: boolean = await checkAdminExists();
		console.log('Admin check', admin);
		return c.json({ error: null, data: admin });
	} catch (error) { }
	return c.text("Get admin");
});

auth.get("/admins", async (c: Context) => {
	try {
		// check if an admin exists
		const admins: boolean = await getAdmins();
		console.log(admins);

		return c.json({ error: null, data: admins });
	} catch (error) { }
	return c.text("Get all admins");
});

auth.delete("/admin/delete", async (c: Context) => {
	try {
		const { email } = await c.req.json();

		if (!email) throw new Error("Invalid email");

		const deleted = await deleteAdmin(email);

		if (!deleted) throw new Error("Failed to delete admin");

		return c.json({ error: null, data: deleted });
	} catch (error) { }
	return c.text("Delete admin");
});

auth.post("/admin/login", async (c: Context) => {
	try {
		const { email, password } = await c.req.json();

		if (!email || !password) throw new Error("Invalid email or password");

		// check if an admin exists
		const loginValid: boolean | string = await checkLoginValid(email, password);

		if (loginValid) {
			let payload = {
				email,
				role: 'admin',
				authenticated: true
			}
			const token = await sign(payload, process.env.USER_AUTH_KEY || "user_key");

			console.log(token);
			// setCookie(c, "admin", JSON.stringify(email), {
			// 	httpOnly: true,
			// 	secure: true,
			// 	sameSite: "Strict",
			// 	maxAge: 60 * 60 * 24 * 7,
			// });

			return c.json({ error: null, data: token });

		}

		return c.json({ error: null, data: loginValid });
	} catch (error) { }
	return c.text("Admin login");
});

auth.post("/admin/logout", async (c: Context) => {
	try {
		// remove the cookie1
		setCookie(c, "admin", "", {
			httpOnly: true,
			secure: true,
			sameSite: "Strict",
			maxAge: 0,
		});
		return c.json({ error: null, data: "Admin logged out" });
	} catch (error) { }
	return c.text("Admin logout");
});

auth.post("/user/create", async (c: Context) => {
	try {
		const details = await c.req.json();

		const { email, password } = details;

		if (!email || !password) throw new Error("Invalid email or password");

		// create collection like normal
		const record = await createRecord(
			{
				...details,
				password: await Bun.password.hash(password),
			},
			"users"
		);

		// remove password from details
		delete details.password;

		if (record?.password) {
			delete record.password;
		}

		return c.json({
			error: null,
			data: record,
		});
	} catch (error) {
		console.log(error);
		return c.json({ error, data: null });
	}
	return c.text("Create user");
});

auth.post("/user/delete", async (c: Context) => {
	try {
		const { id } = await c.req.json();

		if (!id) throw new Error("Invalid id");

		// delete the user
		const deleted = await deleteRecord({ _id: id }, { multi: false }, "users");

		if (!deleted) throw new Error("Failed to delete user");

		return c.json({ error: null, data: deleted });
	} catch (error) { }
	return c.text("Delete user");
});

auth.post("/user/login", async (c: Context) => {
	try {
		const body = await c.req.json();

		const { email, password } = body;

		if (!email || !password) {
			return c.json({ error: "Invalid email or password", data: null });
		}

		console.log(email, password);

		// check if an admin exists
		const user = await readRecord({ email }, "users");
		console.log(user);

		if (user?.length === 0) {
			return c.json({ error: "User does not exist", data: null });
		}

		const loginValid: boolean = await Bun.password.verify(
			password,
			user[0]?.password
		);
		console.log(loginValid);

		if (!loginValid) {
			return c.json({ error: "Invalid login", data: null });
		}

		// sign the token
		const token = await sign(user[0], process.env.USER_AUTH_KEY || "user_key");

		return c.json({
			error: null,
			data: {
				token,
				user: {
					...user[0],
					password: undefined,
				},
			},
		});
	} catch (error) {
		console.log(error);
		return c.json({ error, data: null });
	}
});

auth.get('/oauth_redirect', async (c: Context) => {
	const { code } = c.req.query();
	const oauth2Client = new OAuth2Client({
		clientId: process.env.CLIENT_ID,
		clientSecret: process.env.CLIENT_SECRET,
		redirectUri: 'http://localhost:3690/api/auth/oauth_redirect'
	})

	let token = (await oauth2Client.getToken(code)).tokens.id_token;
	if (token != null) {
		const user_data = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
		console.log(user_data);
		const user = await readRecord({ email: user_data.email }, "users");
		console.log("user", user[0]);
		if (user.length !== 0) {
			const jwt = await sign(user[0], process.env.USER_AUTH_KEY || "user_key");
			return c.redirect(`http://localhost:5173/?jwt=${jwt}`, 301);
		}
		let details = {
			email: user_data.email,
			name: user_data.given_name,
			providers: ['google']
		}
		const record = await createRecord(
			{
				...details,
			},
			"users"
		);
		const jwt = await sign(record, process.env.USER_AUTH_KEY || "user_key");
		return c.redirect(`http://localhost:5173/?jwt=${jwt}`, 301);
	}
	return c.json({
		error: true,
		data: null
	})

})

auth.get('/redirect_test', async (c: Context) => {
	return c.redirect('http://localhost:5173/', 301)
})

auth.post('/google_oauth', async (c: Context) => {
	const oauth2Client = new OAuth2Client({
		clientId: process.env.CLIENT_ID,
		clientSecret: process.env.CLIENT_SECRET,
		redirectUri: 'http://localhost:3690/api/auth/oauth_redirect'
	})
	const authorizeUrl = oauth2Client.generateAuthUrl({
		scope: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'],
	});
	return c.json({
		data: authorizeUrl,
		error: null
	});
});

// TODO
auth.post("/user/reset-password", async (c: Context) => {
	try {
	} catch (error) { }
	return c.text("Reset user password");
});

// TODO
auth.post("/user/forgot-password", async (c: Context) => {
	try {
	} catch (error) { }
	return c.text("Forgot user password");
});

// TODO
auth.post("/user/verify", async (c: Context) => {
	try {
	} catch (error) { }
	return c.text("Verify user");
});

// TODO
auth.post("/user/verify-email", async (c: Context) => {
	try {
	} catch (error) { }
	return c.text("Verify user email");
});

export default auth;