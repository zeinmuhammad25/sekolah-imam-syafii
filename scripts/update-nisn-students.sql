-- Update NISN dan Penyesuaian Nama Siswa Kelas 1 (SD 1)
UPDATE students SET nisn = '3200359913', nama_siswa = 'ABIZAR RAMADHAN' WHERE id = '260032';
UPDATE students SET nisn = '3192391679', nama_siswa = 'AIDIE ARKA JAYA HASIBUAN' WHERE id = '260033';
UPDATE students SET nisn = '3202458552', nama_siswa = 'AIMAN NUR HADI' WHERE id = '260034';
UPDATE students SET nisn = '3197910572', nama_siswa = 'ALIF IBRAHIM ALKAHFI' WHERE id = '260035';
UPDATE students SET nisn = '3204463281', nama_siswa = 'ALIYAH KHAIRANI' WHERE id = '260036';
UPDATE students SET nisn = '3200614394', nama_siswa = 'ALYA FAUZIA RAFI''FA' WHERE id = '260037';
UPDATE students SET nisn = '3200672291', nama_siswa = 'FAQIH ABDURRAHMAN' WHERE id = '260038';
UPDATE students SET nisn = '3205467380', nama_siswa = 'HAFSAH HUNA FA MANIK' WHERE id = '260039';
UPDATE students SET nisn = '3190871039', nama_siswa = 'HAFSHOH NAURA HANIFAH' WHERE id = '260040';
UPDATE students SET nisn = '3202240343', nama_siswa = 'HANA AHANTI RAHILLA' WHERE id = '260041';
UPDATE students SET nisn = '3192635207', nama_siswa = 'IBRAHIM MALIK ISWANTO' WHERE id = '260042';
UPDATE students SET nisn = '3191888990', nama_siswa = 'MUHAMMAD AZKA RAMDHRA' WHERE id = '260043';
UPDATE students SET nisn = '3208586010', nama_siswa = 'MUHAMMAD HUSEIN NASUTION' WHERE id = '260044';
UPDATE students SET nisn = '3200387950', nama_siswa = 'NADHIRA RAISAH' WHERE id = '260045';
UPDATE students SET nisn = '3208715774', nama_siswa = 'NADIRA PUTRI' WHERE id = '260046';
UPDATE students SET nisn = '3198962055', nama_siswa = 'NAZRIL AHMAD' WHERE id = '260047';
UPDATE students SET nisn = '3204942094', nama_siswa = 'RAZZAN SAPRILIAN SAHMI' WHERE id = '260048';
UPDATE students SET nisn = '3203937031', nama_siswa = 'RUMAYSHA AIZZAH RAHMAN' WHERE id = '260049';
UPDATE students SET nisn = '3204237485', nama_siswa = 'SARFARAZ ANDHRA RADHIKA ATMA' WHERE id = '260050';
UPDATE students SET nisn = '3188691948', nama_siswa = 'TENGKU HUMAIRAH SANTUN' WHERE id = '260051';
UPDATE students SET nisn = '3208723530', nama_siswa = 'UBAY LUQMAN' WHERE id = '260052';

-- Update NISN dan Penyesuaian Nama Siswa Kelas 2 (SD 2)
UPDATE students SET nisn = '3199902938', nama_siswa = 'ABHI VANDYA' WHERE id = '250015';
UPDATE students SET nisn = '3181383243', nama_siswa = 'AISYAH SALSABILA' WHERE id = '250016';
UPDATE students SET nisn = '3191898193', nama_siswa = 'AISYAH ZAHIRA' WHERE id = '250017';
UPDATE students SET nisn = '3183965780', nama_siswa = 'AL HAKIM SANJAYA' WHERE id = '250019';
UPDATE students SET nisn = '3180257445', nama_siswa = 'AL ZAIDAN FAEYZA' WHERE id = '250021';
UPDATE students SET nisn = '3192749892', nama_siswa = 'ALDRIAN NOOR HARBYANSAH' WHERE id = '250018';
UPDATE students SET nisn = '3193172832', nama_siswa = 'ALIYA ATMAJA' WHERE id = '250020';
UPDATE students SET nisn = '3188290496', nama_siswa = 'AZRIL RAHANDIKA' WHERE id = '250022';
UPDATE students SET nisn = '3191895376', nama_siswa = 'EVAN YAHYA AL A''RAF' WHERE id = '250023';
UPDATE students SET nisn = '3180905761', nama_siswa = 'MHD. DWI AFANDI' WHERE id = '250024';
UPDATE students SET nisn = '3198141138', nama_siswa = 'M. HAZWAN SANDI' WHERE id = '250025';
UPDATE students SET nisn = '3199356573', nama_siswa = 'MUHAMMAD SULTAN ATHA ABQARY NASUTION' WHERE id = '250026';
UPDATE students SET nisn = '3193826515', nama_siswa = 'NAILAH HANA SYAKIRAH' WHERE id = '250027';
UPDATE students SET nisn = '3194095674', nama_siswa = 'NAZWA ZAHIRA' WHERE id = '250028';
UPDATE students SET nisn = '3188777158', nama_siswa = 'RAYNA SYAHIDA' WHERE id = '250029';
UPDATE students SET nisn = '3199403199', nama_siswa = 'RESVAN APRILIAN SAHMI' WHERE id = '250030';
UPDATE students SET nisn = '3193901950', nama_siswa = 'VIRANDA AL MAIDANI' WHERE id = '250031';

-- Update NISN dan Penyesuaian Nama Siswa Kelas 3 (SD 3)
UPDATE students SET nisn = '3179751244', nama_siswa = 'AISHA ALIFA TANOTO' WHERE id = '240001';
UPDATE students SET nisn = '3179375786', nama_siswa = 'ARRASYIID AL-AUSY' WHERE id = '240002';
UPDATE students SET nisn = '3173406210', nama_siswa = 'DZAKY NOOR HABIBI' WHERE id = '240003';
UPDATE students SET nisn = '3189682841', nama_siswa = 'FIRA MAHARANI' WHERE id = '240004';
UPDATE students SET nisn = '3175322462', nama_siswa = 'HUMAIRA HANUM MANIK' WHERE id = '240005';
UPDATE students SET nisn = '3188843262', nama_siswa = 'KAHFI KHOIRUN FIKRI' WHERE id = '240006';
UPDATE students SET nisn = '3172066334', nama_siswa = 'KEI NADHIRA NASUTION' WHERE id = '240007';
UPDATE students SET nisn = '3187840188', nama_siswa = 'KHAIRA SABILILAH' WHERE id = '240008';
UPDATE students SET nisn = '3172560110', nama_siswa = 'KHAIRUNNISA SILALAHI' WHERE id = '240009';
UPDATE students SET nisn = '3187363232', nama_siswa = 'MUHAMMAD ABIZAR ILHAM' WHERE id = '240010';
UPDATE students SET nisn = '3179423113', nama_siswa = 'NASIRA ASKADINA' WHERE id = '240011';
UPDATE students SET nisn = '3187102884', nama_siswa = 'NAZRAN AZRAQI' WHERE id = '240012';
UPDATE students SET nisn = '3182994657', nama_siswa = 'RIHANNAH SHIHA' WHERE id = '240013';
UPDATE students SET nisn = '3180702791', nama_siswa = 'SHIDQIYAH AYU NASYRAH' WHERE id = '240014';

-- Bump data_version agar edge cache diperbarui
UPDATE meta SET value = value + 1 WHERE key = 'data_version';

