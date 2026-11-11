import axios from 'axios';
import {createContext, useState, useContext, useEffect} from 'react';
import Cookie from 'js-cookie';

export const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) { 
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

export const AuthProvider = ({children}) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const response = await axios.get('http://localhost:3000/api/profile', {withCredentials: true});
                setIsAuthenticated(true);
                setUser(response.data);
            } catch (error) {
                setIsAuthenticated(false);
                setUser(null);
            }
        };
        if(Cookie.get('token')){
            checkAuth();
        }
    }, []);

    const signup = async (data) => {
        clearError();
        try {
            const response = await axios.post('http://localhost:3000/api/signup', data, {withCredentials: true});
            console.log(response);
            setIsAuthenticated(true);
            setUser(response.data);
        }
        catch (error) {
            console.error('Error en el registro:', error);
            setError(error.response?.data?.message || 'Error en el registro');
        }
    };

    const signin = async (data) => {
        clearError();
        try {
            const response = await axios.post('http://localhost:3000/api/signin', data, {withCredentials: true});
            console.log(response);
            setIsAuthenticated(true);
            setUser(response.data);
        }
        catch (error) {
            console.error('Error en el inicio de sesión:', error);
            setError(error.response?.data?.message || 'Error en el inicio de sesión ');
        }
    };

    const clearError = () => {
        setError(null);
    };

    return (
        <AuthContext.Provider value = {{isAuthenticated, user, error, clearError, signup, signin}}>
            {children}
        </AuthContext.Provider>
    );
};
