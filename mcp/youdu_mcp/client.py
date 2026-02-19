import httpx
import time
import json
import base64
from typing import Optional, Dict, Any, Literal
from .crypto import YouduCrypto

class YouduClient:
    def __init__(self, api_url: str, bu_id: int, app_id: str, app_key: str):
        self.api_url = api_url.rstrip('/')
        self.bu_id = bu_id
        self.app_id = app_id
        self.crypto = YouduCrypto(app_id, app_key)
        self._token: Optional[str] = None
        self._token_expiry: float = 0

    async def get_token(self) -> str:
        if self._token and time.time() < self._token_expiry:
            return self._token

        encrypted_ts = self.crypto.encrypt(str(int(time.time())))
        payload = {
            "buin": self.bu_id,
            "appId": self.app_id,
            "encrypt": encrypted_ts
        }
        
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{self.api_url}/cgi/gettoken", json=payload)
            data = resp.json()
            if data.get("errcode") == 0:
                encrypted_res = data.get("encrypt")
                result_json = json.loads(self.crypto.decrypt_to_str(encrypted_res))
                self._token = result_json.get("accessToken")
                self._token_expiry = time.time() + result_json.get("expireIn", 7200) - 60
                return self._token
            else:
                raise Exception(f"Failed to get token: {data}")

    async def request(self, method: str, path: str, params: Dict = None, body: Any = None):
        token = await self.get_token()
        url = f"{self.api_url}{path}"
        
        request_params = params or {}
        request_params["accessToken"] = token

        request_body = None
        if body is not None:
            encrypted_body = self.crypto.encrypt(json.dumps(body))
            request_body = {
                "buin": self.bu_id,
                "appId": self.app_id,
                "encrypt": encrypted_body
            }

        async with httpx.AsyncClient() as client:
            if method.upper() == "GET":
                resp = await client.get(url, params=request_params)
            else:
                resp = await client.post(url, params=request_params, json=request_body)
            
            data = resp.json()
            if data.get("errcode") == 0:
                if "encrypt" in data:
                    dec = self.crypto.decrypt_to_str(data["encrypt"])
                    try:
                        return json.loads(dec)
                    except json.JSONDecodeError as e:
                        if "Extra data" in str(e):
                            # 有度部分接口解密后含多个 JSON 或尾随内容，只解析首段
                            dec = dec.strip()
                            if dec.startswith("{"):
                                end = dec.rfind("}")
                                if end != -1:
                                    try:
                                        return json.loads(dec[: end + 1])
                                    except json.JSONDecodeError:
                                        pass
                        return {"errcode": 0, "_raw": dec}
                return data
            else:
                return data

    async def upload_media(
        self,
        media_type: Literal["image", "file"],
        name: str,
        data: bytes,
    ) -> str:
        """上传图片或文件到素材库，返回 media_id。"""
        token = await self.get_token()
        url = f"{self.api_url}/cgi/media/upload"
        params = {"accessToken": token}
        # 与 Go SDK 一致：meta 为 type+name 的加密；文件部分为「原始文件字节」加密后的 base64 字符串
        meta = self.crypto.encrypt(json.dumps({"type": media_type, "name": name}))
        file_encrypted = self.crypto.encrypt_bytes(data)
        files = {"file": (name, file_encrypted.encode("utf-8"), "application/octet-stream")}
        payload = {"buin": str(self.bu_id), "appId": self.app_id, "encrypt": meta}
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                params=params,
                data=payload,
                files=files,
            )
        data_res = resp.json()
        if data_res.get("errcode") != 0:
            return ""
        enc = data_res.get("encrypt")
        if not enc:
            return ""
        out = json.loads(self.crypto.decrypt_to_str(enc))
        return out.get("mediaId", "")

    async def download_media(self, media_id: str) -> bytes:
        """根据 media_id 下载素材，返回文件二进制内容。"""
        token = await self.get_token()
        url = f"{self.api_url}/cgi/media/get"
        params = {"accessToken": token}
        body = {"buin": self.bu_id, "appId": self.app_id, "encrypt": self.crypto.encrypt(json.dumps({"mediaId": media_id}, separators=(",", ":")))}
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, params=params, json=body)
        if resp.headers.get("content-type", "").startswith("application/json"):
            data_res = resp.json()
            if data_res.get("errcode") != 0:
                raise Exception(f"Download failed: {data_res}")
            enc = data_res.get("encrypt")
            if not enc:
                raise Exception("No encrypt in response")
            raw = self.crypto.decrypt(enc)
            try:
                return base64.b64decode(raw.decode("utf-8"))
            except Exception:
                return raw
        raw_enc = resp.content
        if isinstance(raw_enc, str):
            raw_enc = raw_enc.encode("latin-1")
        try:
            dec = self.crypto.decrypt(raw_enc.decode("utf-8"))
            return base64.b64decode(dec.decode("utf-8")) if dec else b""
        except Exception:
            return raw_enc
