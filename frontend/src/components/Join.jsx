import React, { useState } from 'react'
import api from '../config/axios';

const Join = () => {
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [nick, setNick] = useState("");
  const sendUserData = async (e) => {
    e.preventDefault();
    // console.log(id, pw, nick);

    // 서버로 id, pw, nick을 전송
    try {
      const res = await api.post('/api/members', {
        id: id,
        pw: pw,
        nick: nick,
      });
      console.log(res.data);
      alert("가입 성공");
    } catch (error) {
      console.log(error);
      alert(error);
    }
    setId("");
    setPw("");
    setNick("");
  }

  return (
    <div>
      <form onSubmit={sendUserData}>
        <input type="submit" value="카카오로 시작하기" className='normal' />
        <input type="submit" value="구글로 시작하기" className='normal' />
      </form>
    </div>
  )
}

export default Join