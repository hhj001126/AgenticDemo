"""
有度请求/响应加解密实现。

规范依据：
- 有度「全局说明」「加解密说明」：https://youdu.cn/doc#41-136-加解密说明
- 实现与官方 youdu-sdk-go (aes.go) 对齐，便于与服务端互通。

约定：
- 明文格式：16 字节随机数 + 4 字节消息体长度(大端) + 消息体 + appId
- 填充：按 32 字节对齐（PADDING=32）
- 算法：AES-256-CBC，IV 为 EncodingAESKey 前 16 字节
- 密文：对上述明文填充后加密，再 Base64 编码输出
"""
import base64
import os
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend

PADDING = 32


def _pad(data: bytes) -> bytes:
    """填充到 PADDING(32) 的整数倍，与 Go Padding 一致。"""
    pad = PADDING - (len(data) % PADDING)
    if pad == 0:
        pad = PADDING
    return data + bytes([pad] * pad)


def _unpad(data: bytes) -> bytes:
    """去除尾部填充。"""
    if len(data) < 1:
        return b""
    pad = data[-1]
    if pad > PADDING or pad <= 0 or pad > len(data):
        return b""
    for i in range(len(data) - 1, len(data) - pad - 1, -1):
        if data[i] != pad:
            return b""
    return data[: len(data) - pad]


class YouduCrypto:
    def __init__(self, app_id: str, app_key: str):
        self.app_id = (app_id or "").strip()
        key_b64 = (app_key or "").strip()
        self.key = base64.b64decode(key_b64)
        if len(self.key) != 32:
            raise ValueError("EncodingAESKey 解码后须为 32 字节，请检查 YOUDU_APP_KEY")
        self.iv = self.key[:16]

    def encrypt(self, data: str) -> str:
        """加密字符串。明文格式：16 随机 + 4 长度(大端) + 消息 + appId，再按 32 字节填充。"""
        return self._encrypt_bytes(data.encode("utf-8"))

    def encrypt_bytes(self, data: bytes) -> str:
        """加密二进制（如上传文件内容），与 Go SDK 一致：服务端期望文件部分为「原始文件字节」加密后的 base64。"""
        return self._encrypt_bytes(data)

    def _encrypt_bytes(self, body: bytes) -> str:
        rand_head = os.urandom(16)
        body_len = len(body).to_bytes(4, byteorder="big")
        packed = rand_head + body_len + body + self.app_id.encode("utf-8")
        padded = _pad(packed)
        cipher = Cipher(algorithms.AES(self.key), modes.CBC(self.iv), backend=default_backend())
        encryptor = cipher.encryptor()
        encrypted = encryptor.update(padded) + encryptor.finalize()
        return base64.b64encode(encrypted).decode("utf-8")

    def decrypt(self, encrypted_str: str) -> bytes:
        """解密。密文解密后：前 16 字节为随机头，[16:20] 为长度(大端)，[20:20+len] 为内容。"""
        encrypted_data = base64.b64decode(encrypted_str)
        cipher = Cipher(algorithms.AES(self.key), modes.CBC(self.iv), backend=default_backend())
        decryptor = cipher.decryptor()
        padded = decryptor.update(encrypted_data) + decryptor.finalize()
        raw = _unpad(padded)
        if len(raw) <= 20:
            raise ValueError("解密后长度过短")
        content_len = int.from_bytes(raw[16:20], byteorder="big")
        return raw[20 : 20 + content_len]

    def decrypt_to_str(self, encrypted_str: str) -> str:
        """解密并返回 UTF-8 字符串。"""
        return self.decrypt(encrypted_str).decode("utf-8")
