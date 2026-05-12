import axios from "axios";

const API = axios.create({
  baseURL:"https://rescue-management-backend.onrender.com/api"
});

export default API;