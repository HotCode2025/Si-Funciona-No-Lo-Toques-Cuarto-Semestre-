import jwt from 'jsonwebtoken';

const secretKey = "clave_super_secreta";

const createAccessToken = (payload) => {
    return new Promise((resolve, reject) => {
        jwt.sign(payload, secretKey, { expiresIn: '1h' }, (err, token) => {
            if (err) reject(err);
            resolve(token);
        });
    });
};

const verifyAccessToken = (token) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secretKey, (err, decoded) => {
            if (err) reject(err);
            resolve(decoded);
        });
    });
};

export { createAccessToken, verifyAccessToken };