import fs from "node:fs";
interface IConfig {
  server:{
    port:number
    db_path:string
  },
  secret:{
    jwt:string
    admin_pwd:string
  },
  keepalive:{ //ms
    interval_seconds:number
    timeout_seconds:number
    max_retries:number
  }
}

const default_config: IConfig = {
  server:{
    port:3000,
    db_path:"./data.db"
  },
  secret:{
    jwt:"<KEY>",
    admin_pwd:"<PASSWORD>"
  },
  keepalive:{
    interval_seconds:1000,
    timeout_seconds:1000,
    max_retries:3
  }
};

if (!fs.existsSync("./config.json")) {
  fs.writeFileSync("./config.json", JSON.stringify(default_config, null, 2));
}

const config:IConfig = JSON.parse(fs.readFileSync("./config.json", "utf8"));

export default config;
