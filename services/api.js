import axios from "axios";

const baseURL = process.env.EXPO_PUBLIC_API_URL || "https://rescue-management-backend.onrender.com/api";

const API = axios.create({ baseURL });

export default API;
