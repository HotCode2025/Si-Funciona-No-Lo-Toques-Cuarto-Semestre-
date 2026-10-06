import { verifyAccessToken } from '../libs/jwt.js';

const isAuthenticated = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'No token provided' });
    }
    try {
        const decoded = await verifyAccessToken(token);
        req.userId = decoded.id;
        next();
    } catch (error) {
        console.log('Error verifying token:', error);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

export default isAuthenticated;