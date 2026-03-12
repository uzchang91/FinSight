import React, { useState } from 'react'
import './Login.css'
import logoLong from '../assets/logo-long.svg'
import api from '../config/axios';

const Login = () => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/api/login', {
        id: id,
        pw: pw,
      });
      if (res.data?.success) {
        alert("로그인 성공");
      }
      console.log(res.data)
    } catch (error) {
      console.log(error);
      alert(error);
    }
    setId("");
    setPw("");
  }

  return (
    <div className='login'>
      <form onSubmit={handleLogin} className='login-container'>
        <img src={logoLong} alt="logo-long" className='login-logo' />
        <div className='login-type'>
          <div className='login-id'>
            <input type="text"
              className='login-input'
              value={id} placeholder='카카오메일 아이디, 이메일, 전화번호'
              onChange={e => setId(e.target.value)} />
              <span><strong>TIP</strong> 카카오메일이 있다면 메일 아이디만 입력해 보세요.</span>
          </div>
          <input type="password"
            className='login-input'
            value={pw} placeholder='비밀번호'
            onChange={e => setPw(e.target.value)} />
        </div>
        <div className=''>
          <button type="submit" className='kakao_btn' >로그인</button>
          <div className='login-divide'>
            <div className='divide-slave' />
            <span>또는</span>
            <div className='divide-slave' />
          </div>
          <button type="submit"className='join-btn' >회원가입</button>
        </div>
      </form>
    </div>
  )
}

export default Login