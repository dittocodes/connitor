import { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';

interface DecodedUser {
  id: string;
  phone: string;
  role: string;
  hospitalChainId?: string;
  branchId?: string;
}

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<DecodedUser | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const storedToken = localStorage.getItem('authToken');

    if (storedToken) {
      setToken(storedToken);
      try {
        const decodedUser = jwtDecode<DecodedUser>(storedToken);
        setUser(decodedUser);
      } catch (error) {
        console.warn('Failed to decode token:', error);
        localStorage.removeItem('authToken');
      }
    }
  }, []);

  const login = (newToken: string) => {
    localStorage.setItem('authToken', newToken);
    setToken(newToken);

    try {
      const decodedUser = jwtDecode<DecodedUser>(newToken);
      setUser(decodedUser);
    } catch (error) {
      console.warn('Invalid token on login:', error);
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    setToken(null);
    setUser(null);
  };

  return {
    token,
    user,
    login,
    logout,
    isAuthenticated: !!token,
  };
};
