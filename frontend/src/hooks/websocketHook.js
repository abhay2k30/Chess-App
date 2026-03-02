import { useEffect, useState } from 'react';

export const useSocket = () => {
    const [socket, setSocket] = useState(null);

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8080");

        ws.onopen = () => {
            setSocket(ws);
            console.log("socket connected");
        };

        ws.onclose = () => {
            setSocket(null);
        };

        return () => {
            ws.close(); // this is fine, calling the method not setting it
        };
    }, []);

    return socket;
};