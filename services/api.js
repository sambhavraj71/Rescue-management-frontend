import axios from "axios";

const baseURL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

const API = axios.create({ baseURL });

export default API;
